import AxeBuilder from "@axe-core/playwright";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { Pool } from "pg";

/**
 * מסך "היום": מצבים, נגישות (axe), מקלדת, תנועה, CSP וסימון. השעון של השרת מוזרק לבקשות דרך הכותרת
 * x-tsaad-test-now, והיא פועלת רק בגלל TSAAD_E2E ו־APP_ORIGIN מקומי (ראו src/lib/today/test-clock.ts).
 * START_DATE=2026-12-01 (שעון ישראל, +02:00 בחורף): יום N נפתח ב־05:00 בתאריך 2026-12-N.
 */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(() => pool.end());

const SHOTS = process.env.SHOTS_DIR;
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const HDR = "x-tsaad-test-now";

const T = {
  beforeStart: "2026-11-30T12:00:00+02:00",
  day1Morning: "2026-12-01T08:00:00+02:00",
  day4Noon: "2026-12-04T14:00:00+02:00",
  day4Late: "2026-12-04T23:50:00+02:00",
  day5Night: "2026-12-05T00:30:00+02:00",
  day7: "2026-12-07T10:00:00+02:00",
  day13: "2026-12-13T10:00:00+02:00",
  day12: "2026-12-12T10:00:00+02:00",
  day14Late: "2026-12-15T10:00:00+02:00",
  ended: "2026-12-16T10:00:00+02:00",
  day4Evening: "2026-12-04T20:00:00+02:00",
};

let userId = "";
let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;

async function activate(browser: Browser, username: string) {
  const r = await pool.query(
    `insert into users (username, display_name, email, phone) values ($1, 'בדיקה', $2, '050-111-2222') returning id`,
    [username, `${username}@example.test`],
  );
  const id = r.rows[0].id as string;
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `insert into activation_tokens (user_id, token_hash, purpose, expires_at) values ($1, $2, 'activate', now() + interval '30 minutes')`,
    [id, sha(token)],
  );
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/activate?token=${token}`);
  await page.getByLabel("בחירת סיסמה", { exact: true }).fill("today-pass-12");
  await page.getByLabel("אימות הסיסמה", { exact: true }).fill("today-pass-12");
  await page.getByRole("button", { name: "שמירה וכניסה" }).click();
  await page.waitForURL("**/today");
  const state = await ctx.storageState();
  await ctx.close();
  return { id, state };
}

test.beforeAll(async ({ browser }) => {
  const a = await activate(browser, `today-${randomBytes(3).toString("hex")}`);
  userId = a.id;
  storageState = a.state;
});

async function seed(rows: Array<[number, string]>, uid = userId) {
  await pool.query("delete from action_completions where user_id = $1", [uid]);
  for (const [day, action] of rows) {
    await pool.query("insert into action_completions (user_id, day, action) values ($1, $2, $3)", [uid, day, action]);
  }
}
const countRows = async (uid = userId) =>
  (await pool.query("select count(*)::int as n from action_completions where user_id = $1", [uid])).rows[0].n as number;

async function open(browser: Browser, now: string, opts: { width?: number; reducedMotion?: boolean } = {}) {
  const ctx = await browser.newContext({
    storageState,
    extraHTTPHeaders: { [HDR]: now },
    viewport: { width: opts.width ?? 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: opts.reducedMotion ? "reduce" : "no-preference",
    locale: "he-IL",
  });
  const page = await ctx.newPage();
  await page.goto("/today");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return { ctx, page };
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`)).toEqual([]);
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}-390.png` });
}

const habit = (page: Page) => page.getByRole("button", { name: /^הרגל/ }).first();

test.describe("states (axe, copy, server clock)", () => {
  test("before start: copy, no actions, axe", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.beforeStart);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("האתגר מתחיל ב");
    await expect(page.getByRole("button", { name: /^הרגל/ })).toHaveCount(0);
    await expect(page.locator(".chip")).toHaveCount(0);
    await axe(page);
    await shot(page, "today-before-start");
    await ctx.close();
  });

  test("day 1 morning: hero, chip, video placeholder, empty cup, axe", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.day1Morning);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("הבוקר: מים חמימים עם לימון");
    await expect(page.locator(".chip")).toHaveText("יום 1 מתוך 14");
    await expect(page.getByRole("img", { name: "הכוס של היום, ריקה" })).toBeVisible();
    await expect(page.getByRole("img", { name: "0 מתוך 14 ימים" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^הרגל/ })).toHaveAttribute("aria-pressed", "false");
    await axe(page);
    await shot(page, "today-day1-empty");
    await ctx.close();
  });

  test("day 4 afternoon: 'היום:' hero, a marked habit, half cup, 4 of 14", async ({ browser }) => {
    await seed([[1, "habit"], [2, "habit"], [3, "move"], [4, "habit"]]);
    const { ctx, page } = await open(browser, T.day4Noon);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("היום: שבע דקות אור שמש");
    await expect(habit(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("img", { name: "הכוס של היום, חצי מלאה" })).toBeVisible();
    await expect(page.getByRole("img", { name: "4 מתוך 14 ימים" })).toBeVisible();
    await expect(page.getByText("עוד 8 ימים להשלמת האתגר")).toBeVisible();
    await expect(page.getByText("שכחת לסמן אתמול?")).toHaveCount(0);
    await axe(page);
    await shot(page, "today-day4-half");
    await ctx.close();
  });

  test("live day 7: habit + live, live counts two steps, axe", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.day7);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("היום יש מפגש לייב עם אביטל");
    await expect(page.getByRole("button", { name: /^תנועה/ })).toHaveCount(0);
    await axe(page);
    await page.getByRole("button", { name: /^לייב עם אביטל/ }).click();
    await expect(page.getByRole("img", { name: "הכוס של היום, שלושה רבעים" })).toBeVisible();
    await expect.poll(countRows).toBe(1);
    await page.getByRole("button", { name: /^הרגל/ }).click();
    await expect(page.getByRole("img", { name: "הכוס של היום, מלאה" })).toBeVisible();
    await expect(page.getByText("היום יש שתי פעולות: ההרגל והלייב", { exact: false })).toBeVisible();
    await axe(page);
    await shot(page, "today-day7-live-full");
    await ctx.close();
  });

  test("yesterday prompt: mark until midnight, then it is rejected", async ({ browser }) => {
    await seed([[1, "habit"], [2, "habit"]]);
    const { ctx, page } = await open(browser, T.day4Late);
    await expect(page.getByText("שכחת לסמן אתמול? אפשר עד חצות.")).toBeVisible();
    await axe(page);
    await shot(page, "today-yesterday-prompt");
    await page.getByRole("button", { name: "לסימון אתמול" }).click();
    const group = page.getByRole("group", { name: /הפעולות של יום 3/ });
    await expect(group).toBeVisible();
    await axe(page);
    // After midnight the server refuses, even though this page still shows the button.
    await ctx.setExtraHTTPHeaders({ [HDR]: T.day5Night });
    await group.getByRole("button", { name: /^הרגל/ }).click();
    await expect(page.getByText("הסימון לא נשמר. אפשר לנסות שוב.")).toBeVisible();
    expect(await countRows()).toBe(2);
    // Before midnight it works.
    await ctx.setExtraHTTPHeaders({ [HDR]: T.day4Late });
    await page.getByRole("button", { name: "לנסות שוב" }).click();
    await expect(group.getByRole("button", { name: /^הרגל/ })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(countRows).toBe(3);
    await ctx.close();
  });

  test("after 00:00 the older day is closed: no prompt", async ({ browser }) => {
    await seed([[1, "habit"], [2, "habit"]]);
    const { ctx, page } = await open(browser, T.day5Night);
    await expect(page.locator(".chip")).toHaveText("יום 4 מתוך 14");
    await expect(page.getByText("שכחת לסמן אתמול?")).toHaveCount(0);
    await ctx.close();
  });

  test("unreachable 12: continuing copy replaces the count", async ({ browser }) => {
    await seed([[1, "habit"], [2, "habit"], [3, "habit"], [4, "habit"], [5, "habit"]]);
    const { ctx, page } = await open(browser, T.day13);
    await expect(page.getByText("אפשר להמשיך לתרגל עד יום 14, גם בלי להשלים את האתגר.")).toBeVisible();
    await expect(page.getByText(/עוד \d+ ימים להשלמת האתגר/)).toHaveCount(0);
    await axe(page);
    await shot(page, "today-unreachable");
    await ctx.close();
  });

  test("completion: 12 counted", async ({ browser }) => {
    await seed(Array.from({ length: 12 }, (_, i): [number, string] => [i + 1, "habit"]));
    const { ctx, page } = await open(browser, T.day12);
    await expect(page.getByText("האתגר הושלם")).toBeVisible();
    await expect(page.getByText("אפשר להמשיך עד יום 14.")).toBeVisible();
    await expect(page.getByRole("img", { name: "12 מתוך 14 ימים" })).toBeVisible();
    await axe(page);
    await shot(page, "today-completed");
    await ctx.close();
  });

  test("after the end: day 14 is still markable until midnight, then closed", async ({ browser }) => {
    await seed([]);
    let { ctx, page } = await open(browser, T.day14Late);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("האתגר הסתיים");
    await expect(page.getByText("שכחת לסמן אתמול?")).toBeVisible();
    await axe(page);
    await ctx.close();
    ({ ctx, page } = await open(browser, T.ended));
    await expect(page.getByText("שכחת לסמן אתמול?")).toHaveCount(0);
    await axe(page);
    await shot(page, "today-ended");
    await ctx.close();
  });
});

test.describe("marking", () => {
  test("keyboard: toggle with Enter and Space, toast in a polite status, undo, persists", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.day1Morning);
    await habit(page).focus();
    await page.keyboard.press("Enter");
    await expect(habit(page)).toHaveAttribute("aria-pressed", "true");
    await expect(habit(page)).toBeFocused();
    const region = page.locator(".toast-region");
    await expect(region).toHaveAttribute("aria-live", "polite");
    await expect(region).toContainText("צעד אחד. היום נחשב.");
    await expect(page.getByRole("img", { name: "הכוס של היום, חצי מלאה" })).toBeVisible();
    await expect.poll(countRows).toBe(1);
    await shot(page, "today-toast-saved");
    await axe(page);

    await page.reload();
    await expect(habit(page)).toHaveAttribute("aria-pressed", "true");

    await habit(page).focus();
    await page.keyboard.press("Space");
    await expect(habit(page)).toHaveAttribute("aria-pressed", "false");
    await expect.poll(countRows).toBe(0);

    // undo after marking
    await page.keyboard.press("Enter");
    await expect(habit(page)).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "ביטול הסימון האחרון" }).click();
    await expect(habit(page)).toHaveAttribute("aria-pressed", "false");
    await expect.poll(countRows).toBe(0);
    await ctx.close();
  });

  test("a movement action can be marked", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.day1Morning);
    await page.getByRole("button", { name: /^תנועה/ }).click();
    await expect(page.getByRole("button", { name: /^תנועה/ })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(countRows).toBe(1);
    await ctx.close();
  });

  test("save failure shows an error with retry (no offline-saving claim), offline banner is polite", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.day1Morning);
    let fail = true;
    await page.route("**/today", async (route) => {
      if (fail && route.request().method() === "POST") return route.abort("failed");
      return route.continue();
    });
    await habit(page).click();
    await expect(page.getByText("הסימון לא נשמר. אפשר לנסות שוב.")).toBeVisible();
    await expect(habit(page)).toHaveAttribute("aria-pressed", "false");
    await shot(page, "today-save-failed");
    await axe(page);
    fail = false;
    await page.getByRole("button", { name: "לנסות שוב" }).click();
    await expect(habit(page)).toHaveAttribute("aria-pressed", "true");

    await ctx.setOffline(true);
    const banner = page.getByRole("status").filter({ hasText: "אין חיבור לאינטרנט" });
    await expect(banner).toBeVisible();
    await expect(page.getByText("יישמר כשהחיבור יחזור")).toHaveCount(0);
    await shot(page, "today-offline");
    await axe(page);
    await ctx.setOffline(false);
    await expect(banner).toHaveCount(0);
    await ctx.close();
  });
});

test.describe("shell, motion, video, CSP", () => {
  test("keyboard order, focus visible, landmarks and nav", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.day1Morning);
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("main")).toHaveCount(1);
    const nav = page.getByRole("navigation", { name: "ניווט ראשי" });
    await expect(nav.getByRole("link", { name: "היום" })).toHaveAttribute("aria-current", "page");
    const order: string[] = [];
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press("Tab");
      order.push(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim().slice(0, 14) || ""));
    }
    expect(order[0]).toBe("דילוג לתוכן");
    expect(order.slice(1, 5)).toEqual(["YOGIT, למסך היום", "עצירת אנימציה", expect.stringContaining("הפעלת סרטון"), expect.stringMatching(/^הרגל/)]);
    // focus ring is drawn
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
    expect(outline).toBe("solid");
    await ctx.close();
  });

  test("motion: pause persists, and reduced motion starts paused", async ({ browser }) => {
    await seed([]);
    let { ctx, page } = await open(browser, T.day1Morning);
    const btn = page.getByRole("button", { name: "עצירת אנימציה" });
    await expect(btn).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    await page.reload();
    await expect(page.getByRole("button", { name: "עצירת אנימציה" })).toHaveAttribute("aria-pressed", "true");
    await ctx.close();

    ({ ctx, page } = await open(browser, T.day1Morning, { reducedMotion: true }));
    await expect(page.getByRole("button", { name: "עצירת אנימציה" })).toHaveAttribute("aria-pressed", "true");
    const anim = await page.evaluate(() => getComputedStyle(document.querySelector(".play")!).animationName);
    expect(anim).toBe("none");
    await ctx.close();
  });

  test("320px: no horizontal scroll, axe, in the busiest state", async ({ browser }) => {
    await seed([[1, "habit"]]);
    const { ctx, page } = await open(browser, T.day4Late, { width: 320 });
    await page.getByRole("button", { name: "לסימון אתמול" }).click();
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(sw).toBeLessThanOrEqual(cw);
    await axe(page);
    await ctx.close();
  });

  test("targets are at least 44px", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.day1Morning);
    const boxes = await page.locator("button, a").evaluateAll((els) =>
      els.filter((e) => (e as HTMLElement).offsetParent !== null || getComputedStyle(e).position === "fixed").map((e) => {
        const r = e.getBoundingClientRect();
        return { n: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 20), w: r.width, h: r.height };
      }),
    );
    for (const b of boxes) {
      if (b.n === "דילוג לתוכן") continue;
      expect(b.h, b.n).toBeGreaterThanOrEqual(44);
      expect(b.w, b.n).toBeGreaterThanOrEqual(44);
    }
    await ctx.close();
  });

  test("video: placeholder when none configured, signed iframe when configured, locked/unauth refused", async ({ browser }) => {
    await seed([]);
    // day 5 has no configured id
    let { ctx, page } = await open(browser, "2026-12-05T10:00:00+02:00");
    await expect(page.getByRole("button", { name: /הפעלת סרטון יום 5/ })).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText("הסרטון יעלה לכאן בקרוב.")).toBeVisible();
    await axe(page);
    await ctx.close();

    ({ ctx, page } = await open(browser, T.day4Noon));
    await page.route("https://iframe.mediadelivery.net/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<p>player</p>" }));
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.getByRole("button", { name: "עצירת אנימציה" }).click(); // the play button pulses; pause it so it can be clicked
    await page.getByRole("button", { name: /הפעלת סרטון יום 4/ }).click();
    const frame = page.locator("iframe");
    await expect(frame).toHaveAttribute("title", "סרטון התרגול של יום 4");
    await expect(frame).toHaveAttribute("loading", "lazy");
    await expect(frame).toHaveAttribute("allowfullscreen", "");
    const src = (await frame.getAttribute("src"))!;
    expect(src).toMatch(/^https:\/\/iframe\.mediadelivery\.net\/embed\/e2e-library\/e2evid4\?token=[0-9a-f]{64}&expires=\d+$/);
    expect(src).not.toContain("autoplay");
    await axe(page);

    const ok = await ctx.request.get("/api/video/4");
    expect(ok.status()).toBe(200);
    expect(ok.headers()["cache-control"]).toContain("no-store");
    const locked = await ctx.request.get("/api/video/9");
    expect(locked.status()).toBe(403);
    expect(await locked.text()).not.toContain("e2evid");
    const bad = await ctx.request.get("/api/video/99");
    expect(bad.status()).toBe(400);
    await ctx.close();

    const anon = await browser.newContext();
    expect((await anon.request.get("/api/video/1")).status()).toBe(401);
    await anon.close();
  });

  test("CSP: per-request nonce, no unsafe-inline scripts, no violations, hydrated", async ({ browser }) => {
    await seed([]);
    const ctx = await browser.newContext({ storageState, extraHTTPHeaders: { [HDR]: T.day1Morning } });
    const page = await ctx.newPage();
    const problems: string[] = [];
    page.on("console", (m) => /content security policy|refused to/i.test(m.text()) && problems.push(m.text()));
    const resp = await page.goto("/today");
    const csp = resp!.headers()["content-security-policy"];
    const nonce1 = /'nonce-([^']+)'/.exec(csp)![1];
    const script = /script-src ([^;]+)/.exec(csp)![1];
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-src https://iframe.mediadelivery.net");
    const html = await resp!.text();
    expect(html).toContain(`nonce="${nonce1}"`);
    const resp2 = await page.goto("/today");
    expect(/'nonce-([^']+)'/.exec(resp2!.headers()["content-security-policy"])![1]).not.toBe(nonce1);
    // hydration works under the policy: the click handler runs
    await habit(page).click();
    await expect(habit(page)).toHaveAttribute("aria-pressed", "true");
    expect(problems).toEqual([]);
    await ctx.close();
  });

  test("login page also hydrates under the nonce CSP", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (m) => /content security policy|refused to/i.test(m.text()) && problems.push(m.text()));
    await page.goto("/login");
    await page.getByRole("button", { name: "הצגת הסיסמה" }).click();
    await expect(page.getByRole("button", { name: "הצגת הסיסמה" })).toHaveAttribute("aria-pressed", "true");
    expect(problems).toEqual([]);
  });

  test("root redirects: signed out to /login, signed in to /today; logout works", async ({ browser }) => {
    const anon = await browser.newContext();
    const p0 = await anon.newPage();
    await p0.goto("/");
    await p0.waitForURL("**/login");
    await anon.close();

    const { ctx, page } = await open(browser, T.day1Morning);
    await page.goto("/");
    await page.waitForURL("**/today");
    await page.getByRole("button", { name: "יציאה" }).click();
    await page.waitForURL("**/login");
    await page.goto("/today");
    await page.waitForURL("**/login");
    await ctx.close();
    // the session row was deleted, so the stored cookie is dead for other tests: log in again
    const a = await activate(browser, `today-${randomBytes(3).toString("hex")}`);
    userId = a.id;
    storageState = a.state;
  });
});
