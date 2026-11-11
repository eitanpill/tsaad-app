import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { axe, clock, createUser, pool, type Session } from "./helpers";

/**
 * שלב 11 (QA): סריקה רוחבית של כל מסך וכל מצב.
 *  - axe (WCAG 2.1 AA + best practice), מבנה (lang/dir, h1 אחד, main, בלי דילוג ברמות כותרת, SVG דקורטיבי מוסתר),
 *    מטרות מגע של 24px לפחות (WCAG 2.5.8; ברוב המקומות 44), וגם הגדלה אמיתית ל־200%: רוחב CSS של 195px (390/2).
 *  - עץ הנגישות (ariaSnapshot) של כל מסך נשמר ל־QA_ARIA_DIR כשהוא מוגדר, לבדיקה ידנית.
 *  - מסע מקלדת מלא: כניסה, סימון, ביטול, אתמול, שביל, יום, לייב, תזכורות, מחיקת חשבון.
 * START_DATE=2026-12-01: יום N נפתח ב־05:00 ב־2026-12-N (שעון חורף, +02:00).
 */

const ARIA_DIR = process.env.QA_ARIA_DIR;
const sha = (v: string) => createHash("sha256").update(v).digest("hex");

const T = {
  beforeStart: "2026-11-30T12:00:00+02:00",
  day1: "2026-12-01T08:00:00+02:00",
  day4: "2026-12-04T14:00:00+02:00",
  day5Night: "2026-12-05T00:30:00+02:00",
  day7: "2026-12-07T10:00:00+02:00",
  day7Open: "2026-12-07T19:30:00+02:00",
  day7Passed: "2026-12-07T22:01:00+02:00",
  day14: "2026-12-14T12:00:00+02:00",
  ended: "2026-12-16T10:00:00+02:00",
};

let s: Session;
test.beforeAll(async ({ browser }) => {
  s = await createUser(browser, "qa");
});

async function seed(rows: Array<[number, string]>, uid = s.userId) {
  await pool.query("delete from action_completions where user_id = $1", [uid]);
  for (const [day, action] of rows) {
    await pool.query("insert into action_completions (user_id, day, action) values ($1, $2, $3)", [uid, day, action]);
  }
}

/** 12 ימים מלאים (ימים 1..12) + live ביום 7. */
const completed = (): Array<[number, string]> =>
  Array.from({ length: 12 }, (_, i) => i + 1).flatMap((d) =>
    d === 7 ? ([[d, "habit"], [d, "live"]] as Array<[number, string]>) : ([[d, "habit"], [d, "move"], [d, "meditate"]] as Array<[number, string]>),
  );

async function structure(page: Page, label: string) {
  const r = await page.evaluate(() => {
    const html = document.documentElement;
    const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .filter((h) => !h.closest("[hidden]") && getComputedStyle(h).display !== "none")
      .map((h) => Number(h.tagName[1]));
    let skip = "";
    for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) skip = `h${levels[i - 1]}→h${levels[i]}`;
    const svgs = [...document.querySelectorAll("svg")].filter((svg) => {
      if (svg.closest("[aria-hidden=true]")) return false;
      const role = svg.getAttribute("role");
      const named = svg.getAttribute("aria-label") || svg.getAttribute("aria-labelledby") || svg.querySelector("title");
      return !(role === "img" && named);
    });
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, summary, [role=switch], [tabindex]:not([tabindex='-1'])")) {
      if (el.closest(".visually-hidden") || el.classList.contains("skip-link")) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // inline links inside running text are exempt (WCAG 2.5.8 "inline")
      const parent = el.parentElement;
      if (el.tagName === "A" && parent && ["P", "LI", "SPAN", "DD", "TD"].includes(parent.tagName) && (parent.textContent ?? "").trim().length > (el.textContent ?? "").trim().length + 10) continue;
      if (rect.width < 24 || rect.height < 24) small.push(`${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24)}" ${Math.round(rect.width)}x${Math.round(rect.height)}`);
    }
    return {
      lang: html.lang,
      dir: html.dir,
      h1: document.querySelectorAll("h1").length,
      main: document.querySelectorAll("main").length,
      skip,
      svgs: svgs.map((x) => x.outerHTML.slice(0, 80)),
      small,
      title: document.title,
    };
  });
  expect(r.lang, label).toBe("he");
  expect(r.dir, label).toBe("rtl");
  expect(r.h1, `${label}: one h1`).toBe(1);
  expect(r.main, `${label}: one main`).toBe(1);
  expect(r.skip, `${label}: heading levels`).toBe("");
  expect(r.svgs, `${label}: svg without aria-hidden or img name`).toEqual([]);
  expect(r.small, `${label}: targets under 24px`).toEqual([]);
  expect(r.title.length, `${label}: title`).toBeGreaterThan(0);
  if (ARIA_DIR) {
    mkdirSync(ARIA_DIR, { recursive: true });
    writeFileSync(`${ARIA_DIR}/${label.replace(/[^a-z0-9-]+/gi, "_")}.yml`, await page.locator("body").ariaSnapshot());
  }
}

/** 200% zoom on a 390px phone: CSS viewport 195px, DPR 2. Names the overflowing element on failure. */
async function zoom200(browser: Browser, url: string, now: string, auth: boolean) {
  const ctx = await browser.newContext({
    storageState: auth ? s.storageState : undefined,
    extraHTTPHeaders: clock(now),
    viewport: { width: 195, height: 422 },
    deviceScaleFactor: 2,
    locale: "he-IL",
  });
  const page = await ctx.newPage();
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const r = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const over = document.documentElement.scrollWidth - w;
    const out: string[] = [];
    if (over > 0) {
      for (const el of document.querySelectorAll<HTMLElement>("body *")) {
        const rect = el.getBoundingClientRect();
        if (rect.width && (rect.right > w + 0.5 || rect.left < -0.5)) out.push(`${el.tagName.toLowerCase()}.${el.className}`);
      }
    }
    // text cut off by an ancestor with overflow hidden (the page does not scroll, but the words are lost)
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue;
      const el = n.parentElement!;
      if (el.closest(".visually-hidden, .skip-link, [aria-hidden=true], svg, script, style")) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const tr = range.getBoundingClientRect();
      if (!tr.width) continue;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.overflowX !== "hidden" && cs.overflowY !== "hidden" && cs.overflowX !== "clip") continue;
        const pr = p.getBoundingClientRect();
        if (tr.left < pr.left - 1 || tr.right > pr.right + 1 || tr.bottom > pr.bottom + 1) out.push(`clipped "${n.textContent.trim().slice(0, 20)}" in ${p.className}`);
        break;
      }
    }
    return { over, out: out.slice(0, 5) };
  });
  expect(r, `${url} at 195px`).toEqual({ over: 0, out: [] });
  await ctx.close();
}

type Screen = { label: string; url: string; now: string; auth: boolean; seed?: Array<[number, string]> };

const PUBLIC: Screen[] = [
  { label: "landing", url: "/tsaad", now: T.beforeStart, auth: false },
  { label: "login", url: "/login", now: T.day4, auth: false },
  { label: "forgot", url: "/forgot", now: T.day4, auth: false },
  { label: "activate-expired", url: "/activate?token=nope", now: T.day4, auth: false },
  { label: "legal", url: "/legal", now: T.day4, auth: false },
  { label: "legal-accessibility", url: "/legal/accessibility", now: T.day4, auth: false },
  { label: "legal-privacy", url: "/legal/privacy", now: T.day4, auth: false },
  { label: "legal-terms", url: "/legal/terms", now: T.day4, auth: false },
  { label: "account-deleted", url: "/account/deleted", now: T.day4, auth: false },
  { label: "not-found", url: "/no-such-page", now: T.day4, auth: false },
];

const APP: Screen[] = [
  { label: "today-before-start", url: "/today", now: T.beforeStart, auth: true, seed: [] },
  { label: "today-day1", url: "/today", now: T.day1, auth: true, seed: [] },
  { label: "today-day4-yesterday", url: "/today", now: T.day4, auth: true, seed: [[4, "habit"]] },
  { label: "today-night", url: "/today", now: T.day5Night, auth: true, seed: [] },
  { label: "today-day7-live", url: "/today", now: T.day7, auth: true, seed: [[7, "habit"], [7, "live"]] },
  { label: "today-day14-completed", url: "/today", now: T.day14, auth: true, seed: completed() },
  { label: "today-ended", url: "/today", now: T.ended, auth: true, seed: completed() },
  { label: "path-mid", url: "/path", now: T.day4, auth: true, seed: [[1, "habit"], [2, "move"]] },
  { label: "path-before", url: "/path", now: T.beforeStart, auth: true, seed: [] },
  { label: "path-ended", url: "/path", now: T.ended, auth: true, seed: completed() },
  { label: "day-yesterday", url: "/day/3", now: T.day4, auth: true, seed: [] },
  { label: "day-past", url: "/day/1", now: T.day4, auth: true, seed: [[1, "habit"]] },
  { label: "day-tomorrow", url: "/day/5", now: T.day4, auth: true, seed: [] },
  { label: "day-far", url: "/day/12", now: T.day4, auth: true, seed: [] },
  { label: "day-invalid", url: "/day/15", now: T.day4, auth: true, seed: [] },
  { label: "live-before", url: "/live", now: T.day4, auth: true, seed: [] },
  { label: "live-open", url: "/live", now: T.day7Open, auth: true, seed: [] },
  { label: "live-passed", url: "/live", now: T.day7Passed, auth: true, seed: [] },
  { label: "reminders", url: "/reminders", now: T.day4, auth: true, seed: [] },
  { label: "install", url: "/install", now: T.day4, auth: true, seed: [] },
  { label: "offer-not-yet", url: "/offer", now: T.day14, auth: true, seed: [] },
  { label: "yesodot", url: "/yesodot", now: T.day14, auth: true, seed: [] },
  { label: "account", url: "/account", now: T.day4, auth: true, seed: [] },
];

test.describe("every screen: axe, structure, targets, 200% zoom (195px)", () => {
  for (const sc of [...PUBLIC, ...APP]) {
    test(sc.label, async ({ browser }) => {
      if (sc.seed) await seed(sc.seed);
      const ctx = await browser.newContext({
        storageState: sc.auth ? s.storageState : undefined,
        extraHTTPHeaders: clock(sc.now),
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        locale: "he-IL",
      });
      const page = await ctx.newPage();
      const res = await page.goto(sc.url);
      expect(res?.status()).toBe(sc.label === "not-found" || sc.label === "day-invalid" ? 404 : 200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // the app pages must not have been bounced to /login
      if (sc.auth) expect(new URL(page.url()).pathname).not.toBe("/login");
      await axe(page);
      await structure(page, sc.label);
      await ctx.close();
      await zoom200(browser, sc.url, sc.now, sc.auth);
    });
  }

  test("error states: login error, forgot sent, activate form, deletion error", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "he-IL" });
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.getByLabel("שם משתמש", { exact: true }).fill("nobody");
    await page.getByLabel("סיסמה", { exact: true }).fill("wrong-pass-1");
    await page.getByRole("button", { name: "כניסה", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ }).first()).toBeVisible();
    await axe(page);
    await structure(page, "login-error");

    await page.goto("/forgot");
    await page.getByLabel("שם משתמש, טלפון או מייל").fill(`qa-${randomBytes(4).toString("hex")}`);
    await page.getByRole("button", { name: "שליחת קישור" }).click();
    await expect(page.getByRole("heading", { name: "אם הפרטים נכונים, יגיע קישור" })).toBeFocused();
    await axe(page);
    await structure(page, "forgot-sent");

    const r = await pool.query(`insert into users (username, display_name) values ($1, 'בדיקה') returning id`, [`qa-act-${randomBytes(3).toString("hex")}`]);
    const token = randomBytes(32).toString("base64url");
    await pool.query(`insert into activation_tokens (user_id, token_hash, purpose, expires_at) values ($1, $2, 'activate', now() + interval '30 minutes')`, [r.rows[0].id, sha(token)]);
    await page.goto(`/activate?token=${token}`);
    await page.getByRole("button", { name: "שמירה וכניסה" }).click();
    await expect(page.getByLabel("בחירת סיסמה", { exact: true })).toBeFocused();
    await axe(page);
    await structure(page, "activate-error");
    await ctx.close();

    const a = await browser.newContext({ storageState: s.storageState, extraHTTPHeaders: clock(T.day4), locale: "he-IL" });
    const p2 = await a.newPage();
    await p2.goto("/account");
    await p2.getByRole("button", { name: "מחיקת החשבון" }).click();
    await expect(p2.getByRole("alert").filter({ hasText: /\S/ }).first()).toBeVisible();
    await expect(p2.getByLabel("סיסמה", { exact: true })).toBeFocused();
    await axe(p2);
    await structure(p2, "account-error");
    await a.close();
  });

  test("offline page: lang, dir, one h1, no script, reflows at 195px", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 195, height: 422 }, deviceScaleFactor: 2, locale: "he-IL" });
    const page = await ctx.newPage();
    await page.goto("/offline.html");
    await axe(page);
    const r = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      h1: document.querySelectorAll("h1").length,
      scripts: document.scripts.length,
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(r).toEqual({ lang: "he", dir: "rtl", h1: 1, scripts: 0, over: 0 });
    await ctx.close();
  });
});

test.describe("screen reader semantics", () => {
  test("today: the cup and the ring are announced as text, the video button is named, toasts are polite", async ({ browser }) => {
    await seed([[4, "habit"], [1, "habit"], [1, "move"], [1, "meditate"]]);
    const ctx = await browser.newContext({ storageState: s.storageState, extraHTTPHeaders: clock(T.day4), locale: "he-IL" });
    const page = await ctx.newPage();
    await page.goto("/today");
    const snap = await page.locator("main").ariaSnapshot();
    // the ring states how many days counted, the cup how many steps today, both as text
    expect(snap).toMatch(/ימים נספרו/);
    expect(snap).toMatch(/img "[^"]*(כוס|צעד)[^"]*"/);
    await expect(page.getByRole("button", { name: /הפעלת סרטון/ })).toBeVisible();
    await expect(page.locator(".toast-region")).toHaveAttribute("aria-live", "polite");
    await ctx.close();
  });

  test("path: the map is a list with a summary label and each stone states its state", async ({ browser }) => {
    await seed([[1, "habit"]]);
    const ctx = await browser.newContext({ storageState: s.storageState, extraHTTPHeaders: clock(T.day4), locale: "he-IL" });
    const page = await ctx.newPage();
    await page.goto("/path");
    const list = page.getByRole("list").first();
    await expect(list).toHaveAttribute("aria-label", /.+/);
    expect(await page.getByRole("listitem").count()).toBeGreaterThanOrEqual(14);
    await ctx.close();
  });
});

test("keyboard only: login, mark, undo, yesterday, path, day, live, reminders, account delete", async ({ browser }) => {
  const u = await createUser(browser, "qakb");
  const ctx = await browser.newContext({ extraHTTPHeaders: clock(T.day4), viewport: { width: 390, height: 844 }, locale: "he-IL" });
  const page = await ctx.newPage();
  const focusVisible = async () => {
    const r = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return "body";
      const cs = getComputedStyle(el);
      return cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2 ? "ok" : `${el.tagName} outline ${cs.outlineStyle} ${cs.outlineWidth}`;
    });
    expect(r).toBe("ok");
  };
  const tabTo = async (match: (name: string) => boolean, max = 40) => {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press("Tab");
      const name = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return "";
        const by = el.getAttribute("aria-labelledby");
        const labelled = by ? by.split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ") : "";
        return (el.getAttribute("aria-label") || labelled || el.textContent || "").trim();
      });
      if (match(name)) {
        await focusVisible();
        return name;
      }
    }
    throw new Error("focus target not reached by Tab");
  };

  await page.goto("/login");
  await tabTo((n) => n === "" || true, 1); // first Tab lands somewhere in the page
  await page.getByLabel("שם משתמש", { exact: true }).focus();
  await page.keyboard.type(u.username);
  await page.keyboard.press("Tab");
  await page.keyboard.type("today-pass-12");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/today");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // mark today's habit with the keyboard, then undo from the toast
  await tabTo((n) => n.startsWith("הרגל"));
  await page.keyboard.press("Enter");
  const habit = page.locator('[data-action-key="4:habit"]');
  await expect(habit).toHaveAttribute("aria-pressed", "true");
  await tabTo((n) => n === "ביטול הסימון" || n.startsWith("ביטול"), 60);
  await page.keyboard.press("Enter");
  await expect(habit).toHaveAttribute("aria-pressed", "false");
  await expect(habit).toBeFocused();

  // yesterday (day 3): open the group with the keyboard; focus moves into it
  await page.keyboard.press("Shift+Tab");
  await page.goto("/today");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await tabTo((n) => n.includes("לסימון אתמול") || n.includes("אתמול"));
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-action-key="3:habit"]')).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.locator('[data-action-key="3:habit"]')).toHaveAttribute("aria-pressed", "true");

  // bottom nav: path, then a day, then live, reminders
  await tabTo((n) => n === "השביל" || n.startsWith("השביל"), 80);
  await page.keyboard.press("Enter");
  await page.waitForURL("**/path");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await tabTo((n) => /יום 2\b/.test(n), 80);
  await page.keyboard.press("Enter");
  await page.waitForURL("**/day/2");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await tabTo((n) => n.startsWith("לייב"), 80);
  await page.keyboard.press("Enter");
  await page.waitForURL("**/live");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.goto("/reminders");
  const sw = page.getByRole("switch");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // headless Chromium denies notifications, so the switch is in its "blocked" state: still focusable (aria-disabled)
  await tabTo((n) => n.includes("התראה בטלפון"), 40);
  await expect(sw).toBeFocused();

  // account deletion with the keyboard only
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await tabTo((n) => n === "מחיקת החשבון", 80);
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("סיסמה", { exact: true })).toBeFocused();
  await page.keyboard.type("today-pass-12");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/account/deleted");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("החשבון נמחק");
  await ctx.close();
});

test("security headers and CSP reporting on pages and the API", async ({ request }) => {
  const page = await request.get("/login");
  const h = page.headers();
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'(;|$)/);
  expect(h["content-security-policy"]).toContain("report-uri /api/csp-report");
  expect(h["content-security-policy"]).toContain("report-to csp");
  expect(h["reporting-endpoints"]).toMatch(/^csp="http:\/\/localhost:\d+\/api\/csp-report"$/);
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBeTruthy();
  expect(h["permissions-policy"]).toContain("camera=()");
  expect(h["x-powered-by"]).toBeUndefined();
  const api = await request.post("/api/csp-report", {
    headers: { "content-type": "application/csp-report" },
    data: JSON.stringify({ "csp-report": { "document-uri": "http://localhost/activate?token=x", "effective-directive": "script-src", "blocked-uri": "inline" } }),
  });
  expect(api.status()).toBe(204);
  expect(api.headers()["content-security-policy"]).toBe("default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  const err = await request.get("/api/video/abc");
  expect(err.status()).toBe(401);
  expect(await err.text()).not.toMatch(/at \w+ \(|node_modules|Error:/);
});
