import AxeBuilder from "@axe-core/playwright";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { Pool } from "pg";
import { DAYS } from "../src/content/days";

/**
 * השביל (/path) והמסך של יום (/day/[n]): מצבי האבנים לפי שעון השרת (שעון הבדיקות, ראו today.spec.ts), נעילה,
 * נגישות (axe), מקלדת, תנועה, 320px, ובדיקה שתוכן של יום נעול לא נשלח ללקוח (HTML ו־JS).
 * START_DATE=2026-12-01 (שעון ישראל, +02:00 בחורף): יום N נפתח ב־05:00 בתאריך 2026-12-N.
 */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(() => pool.end());

const SHOTS = process.env.SHOTS_DIR;
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const KEY = process.env.TSAAD_TEST_CLOCK_KEY!;
const clock = (now: string) => ({ "x-tsaad-test-now": now, "x-tsaad-test-key": KEY });

const T = {
  beforeStart: "2026-11-30T12:00:00+02:00",
  day1Morning: "2026-12-01T08:00:00+02:00",
  day4Noon: "2026-12-04T14:00:00+02:00",
  day4Late: "2026-12-04T23:50:00+02:00",
  day5Night: "2026-12-05T00:30:00+02:00",
  day7: "2026-12-07T10:00:00+02:00",
  day13: "2026-12-13T10:00:00+02:00",
  day14Late: "2026-12-15T10:00:00+02:00",
  ended: "2026-12-16T10:00:00+02:00",
};

let userId = "";
let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;

test.beforeAll(async ({ browser }) => {
  const username = `path-${randomBytes(3).toString("hex")}`;
  const r = await pool.query(
    `insert into users (username, display_name, email, phone) values ($1, 'בדיקה', $2, '050-111-2222') returning id`,
    [username, `${username}@example.test`],
  );
  userId = r.rows[0].id as string;
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `insert into activation_tokens (user_id, token_hash, purpose, expires_at) values ($1, $2, 'activate', now() + interval '30 minutes')`,
    [userId, sha(token)],
  );
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/activate?token=${token}`);
  await page.getByLabel("בחירת סיסמה", { exact: true }).fill("today-pass-12");
  await page.getByLabel("אימות הסיסמה", { exact: true }).fill("today-pass-12");
  await page.getByRole("button", { name: "שמירה וכניסה" }).click();
  await page.waitForURL("**/today");
  storageState = await ctx.storageState();
  await ctx.close();
});

async function seed(rows: Array<[number, string]>) {
  await pool.query("delete from action_completions where user_id = $1", [userId]);
  for (const [day, action] of rows) {
    await pool.query("insert into action_completions (user_id, day, action) values ($1, $2, $3)", [userId, day, action]);
  }
}
const countRows = async () =>
  (await pool.query("select count(*)::int as n from action_completions where user_id = $1", [userId])).rows[0].n as number;
const habits = (days: number[]): Array<[number, string]> => days.map((d) => [d, "habit"]);

async function open(
  browser: Browser,
  now: string,
  url: string,
  opts: { width?: number; reducedMotion?: boolean } = {},
) {
  const ctx = await browser.newContext({
    storageState,
    extraHTTPHeaders: clock(now),
    viewport: { width: opts.width ?? 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: opts.reducedMotion ? "reduce" : "no-preference",
    locale: "he-IL",
  });
  const page = await ctx.newPage();
  await page.goto(url);
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

const stones = (page: Page) => page.locator("ol.stones > li");
const stoneNames = async (page: Page) =>
  (await stones(page).evaluateAll((els) => els.map((e) => e.querySelector(".visually-hidden")?.textContent ?? ""))) as string[];
const stoneLinks = async (page: Page) =>
  (await stones(page).evaluateAll((els) =>
    els.map((e) => e.querySelector("a")?.getAttribute("href") ?? null),
  )) as Array<string | null>;

test.describe("path: states", () => {
  test("before start: 14 locked stones, none a link, counter 0, axe", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.beforeStart, "/path");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("השביל שלך");
    await expect(stones(page)).toHaveCount(14);
    const names = await stoneNames(page);
    expect(names[0]).toBe("יום 1, עוד לא נפתח");
    expect(names[6]).toBe("יום 7, לייב, עוד לא נפתח");
    expect(names[13]).toBe("יום 14, לייב, עוד לא נפתח");
    expect(names.every((n) => n.endsWith("עוד לא נפתח"))).toBe(true);
    expect((await stoneLinks(page)).every((h) => h === null)).toBe(true);
    await expect(page.locator(".chip--count")).toHaveText("0 מתוך 14");
    await expect(page.locator("ol.stones")).toHaveAttribute("aria-label", "14 ימים, 0 נספרו. מפגשי לייב ביום 7 וביום 14");
    await axe(page);
    await shot(page, "path-before-start");
    await ctx.close();
  });

  test("mid challenge (day 4): counted, today, locked, tomorrow link, live tags, legend, axe", async ({ browser }) => {
    await seed([[1, "habit"], [2, "habit"], [3, "move"], [4, "habit"]]);
    const { ctx, page } = await open(browser, T.day4Noon, "/path");
    const names = await stoneNames(page);
    expect(names.slice(0, 5)).toEqual(["יום 1, נספר", "יום 2, נספר", "יום 3, נספר", "יום 4, היום", "יום 5, עוד לא נפתח"]);
    expect(names[6]).toBe("יום 7, לייב, עוד לא נפתח");
    const links = await stoneLinks(page);
    expect(links.slice(0, 6)).toEqual(["/day/1", "/day/2", "/day/3", "/today", "/day/5", null]);
    await expect(page.locator(".chip--count")).toHaveText("4 מתוך 14");
    await expect(page.locator(".stone-tag")).toHaveText("היום");
    await expect(page.locator(".stone-num").nth(6)).toHaveText("7 · לייב");
    await expect(page.locator(".stone-num").nth(13)).toHaveText("14 · לייב");
    const legend = page.locator(".t-legend li");
    // as in AppPath: only the states that are on the path (no missed day yet)
    await expect(legend).toHaveText(["נספר", "היום", "עוד לא נפתח", "מפגש לייב"]);
    await expect(page.getByRole("navigation", { name: "ניווט ראשי" }).getByRole("link", { name: "השביל" })).toHaveAttribute("aria-current", "page");
    await axe(page);
    await shot(page, "path-mid");
    await ctx.close();
  });

  test("missed days and a markable yesterday (day 7)", async ({ browser }) => {
    await seed(habits([1, 3, 5]));
    const { ctx, page } = await open(browser, T.day7, "/path");
    const names = await stoneNames(page);
    expect(names.slice(0, 8)).toEqual([
      "יום 1, נספר",
      "יום 2, לא נספר",
      "יום 3, נספר",
      "יום 4, לא נספר",
      "יום 5, נספר",
      "יום 6, אפשר לסמן עד חצות",
      "יום 7, לייב, היום",
      "יום 8, עוד לא נפתח",
    ]);
    await expect(page.locator(".t-legend li")).toHaveText(["נספר", "היום", "אפשר לסמן עד חצות", "לא נספר", "עוד לא נפתח", "מפגש לייב"]);
    // yesterday differs from "missed" by a clock badge (shape), not only by tone; the legend swatch carries it too
    await expect(page.locator('.stone[data-state="yesterday"] .stone-badge')).toHaveCount(1);
    await expect(page.locator('.stone[data-state="missed"] .stone-badge')).toHaveCount(0);
    await expect(page.locator(".t-legend li").nth(2).locator(".stone-badge")).toHaveCount(1);
    // older missed days still open their screen (view only)
    expect((await stoneLinks(page))[1]).toBe("/day/2");
    await axe(page);
    await shot(page, "path-missed-yesterday");
    await ctx.close();
  });

  test("midnight boundary: at 00:30 yesterday's window is closed", async ({ browser }) => {
    await seed(habits([1, 2]));
    const { ctx, page } = await open(browser, T.day5Night, "/path");
    const names = await stoneNames(page);
    // the date is the 5th but the challenge day is still 4 until 05:00; day 3 closed at 00:00
    expect(names.slice(2, 5)).toEqual(["יום 3, לא נספר", "יום 4, היום", "יום 5, עוד לא נפתח"]);
    await expect(page.locator(".t-legend li")).toHaveCount(5);
    await ctx.close();
  });

  test("completed: 12 counted shows the completion line", async ({ browser }) => {
    await seed(habits([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
    const { ctx, page } = await open(browser, T.day13, "/path");
    await expect(page.locator(".t-path-hero p")).toHaveText("12 מתוך 14. האתגר הושלם.");
    await expect(page.locator(".chip--count")).toHaveText("12 מתוך 14");
    const names = await stoneNames(page);
    expect(names[11]).toBe("יום 12, נספר");
    expect(names[12]).toBe("יום 13, היום");
    expect(names[13]).toBe("יום 14, לייב, עוד לא נפתח");
    await axe(page);
    await shot(page, "path-completed");
    await ctx.close();
  });

  test("after the end: nothing locked, day 14 markable until midnight, then closed", async ({ browser }) => {
    await seed(habits([1, 2, 3, 4, 5, 6, 7, 8]));
    let { ctx, page } = await open(browser, T.day14Late, "/path");
    let names = await stoneNames(page);
    expect(names[13]).toBe("יום 14, לייב, אפשר לסמן עד חצות");
    expect(names[8]).toBe("יום 9, לא נספר");
    expect(names.some((n) => n.endsWith("עוד לא נפתח") || n.endsWith("היום"))).toBe(false);
    await expect(page.locator(".chip--count")).toHaveText("8 מתוך 14");
    // the legend lists only states that can still occur: no "today", no "not open yet"
    await expect(page.locator(".t-legend li")).toHaveText(["נספר", "אפשר לסמן עד חצות", "לא נספר", "מפגש לייב"]);
    await axe(page);
    await shot(page, "path-after-end");
    await ctx.close();
    ({ ctx, page } = await open(browser, T.ended, "/path"));
    names = await stoneNames(page);
    expect(names[13]).toBe("יום 14, לייב, לא נספר");
    await expect(page.locator(".t-legend li")).toHaveText(["נספר", "לא נספר", "מפגש לייב"]);
    await ctx.close();
  });
});

test.describe("path: accessibility", () => {
  test("list semantics, keyboard order, focus ring, enter opens a day, targets 44px", async ({ browser }) => {
    await seed(habits([1, 2, 3]));
    const { ctx, page } = await open(browser, T.day4Noon, "/path");
    await expect(page.getByRole("list", { name: /14 ימים, 3 נספרו/ })).toBeVisible();
    await expect(page.getByRole("listitem")).not.toHaveCount(0);
    const nav = page.getByRole("navigation", { name: "ניווט ראשי" });
    await expect(nav.getByRole("link", { name: "השביל" })).toHaveAttribute("aria-current", "page");
    // the map links are keyboard reachable, in stone order, after the header controls
    const link3 = page.getByRole("link", { name: "יום 3, נספר" });
    await link3.focus();
    expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).toBe("solid");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "יום 4, היום" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "יום 5, עוד לא נפתח" })).toBeFocused();
    // locked stones other than tomorrow are not focusable
    await expect(page.getByRole("link", { name: /יום 6,/ })).toHaveCount(0);
    const boxes = await page.locator("ol.stones a").evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { n: e.textContent ?? "", w: r.width, h: r.height };
      }),
    );
    for (const b of boxes) {
      expect(b.h, b.n).toBeGreaterThanOrEqual(44);
      expect(b.w, b.n).toBeGreaterThanOrEqual(44);
    }
    await link3.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/day/3");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("יום 3");
    await ctx.close();
  });

  test("320px: no horizontal scroll, no overlap between stone targets, axe", async ({ browser }) => {
    await seed(habits([1, 3]));
    const { ctx, page } = await open(browser, T.day7, "/path", { width: 320 });
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(sw).toBeLessThanOrEqual(cw);
    const rects = await page.locator("ol.stones a").evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { n: e.getAttribute("href"), l: r.left, r: r.right, t: r.top, b: r.bottom };
      }),
    );
    for (let i = 0; i < rects.length; i++) {
      expect(rects[i].l).toBeGreaterThanOrEqual(0);
      expect(rects[i].r).toBeLessThanOrEqual(cw);
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], c = rects[j];
        const overlap = a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b;
        expect(overlap, `${a.n} vs ${c.n}`).toBe(false);
      }
    }
    await axe(page);
    await shot(page, "path-mid-320");
    await ctx.close();
  });

  test("reduced motion stops the water and the today glow", async ({ browser }) => {
    await seed(habits([1, 2]));
    const { ctx, page } = await open(browser, T.day4Noon, "/path", { reducedMotion: true });
    const names = await page.evaluate(() => [
      getComputedStyle(document.querySelector(".stone .wave")!).animationName,
      getComputedStyle(document.querySelector(".stone-rock--today")!).animationName,
    ]);
    expect(names).toEqual(["none", "none"]);
    await ctx.close();
  });
});

test.describe("bottom nav never hides content", () => {
  test("keyboard focus stops above the fixed nav, and the logout link clears it at the end of every app page", async ({ browser }) => {
    await seed(habits([1, 3]));
    for (const [url, now, width] of [
      ["/today", T.day7, 390],
      ["/path", T.day7, 390],
      ["/path", T.day7, 320],
      ["/day/2", T.day4Noon, 390],
      ["/day/3", T.day4Noon, 390],
      ["/day/5", T.day4Noon, 390],
    ] as const) {
      const { ctx, page } = await open(browser, now, url, { width });
      const hidden: string[] = [];
      for (let i = 0; i < 45; i++) {
        await page.keyboard.press("Tab");
        const r = await page.evaluate(() => {
          const a = document.activeElement as HTMLElement | null;
          if (!a || a === document.body || a.closest(".bnav")) return null;
          const f = a.getBoundingClientRect();
          const navTop = document.querySelector(".bnav")!.getBoundingClientRect().top;
          return f.bottom > navTop ? `${a.tagName} "${(a.textContent ?? "").slice(0, 24)}" ${Math.round(f.bottom)} > ${Math.round(navTop)}` : null;
        });
        if (r) hidden.push(r);
      }
      expect(hidden, `${url} @${width}`).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const hit = await page.evaluate(() => {
        const b = document.querySelector(".app-foot button")!.getBoundingClientRect();
        const navTop = document.querySelector(".bnav")!.getBoundingClientRect().top;
        const el = document.elementFromPoint(b.left + b.width / 2, b.bottom - 2);
        return { onTop: el?.closest(".app-foot") != null, gap: navTop - b.bottom };
      });
      expect(hit.onTop, `${url} @${width}`).toBe(true);
      expect(hit.gap, `${url} @${width}`).toBeGreaterThanOrEqual(16);
      if (url === "/path" && width === 390) {
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await shot(page, "path-scrolled-end");
      }
      await ctx.close();
    }
  });
});

test.describe("day screen", () => {
  test("older day, not marked: view only, 'לא נספר', video stays available, axe", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.day4Noon, "/day/2");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("יום 2");
    await expect(page.locator(".eyebrow-s")).toHaveText("לא נספר");
    await expect(page.getByText("הסימון של יום 2 נסגר, ולכן הוא לא נספר. אפשר לצפות בסרטון.")).toBeVisible();
    // the day's own content is shown, but nothing can be marked
    await expect(page.getByText(DAYS[1].habit.title)).toBeVisible();
    await expect(page.locator("p.opening")).toHaveText(DAYS[1].opening);
    await expect(page.getByRole("button", { name: /^(הרגל|תנועה|מדיטציה)/ })).toHaveCount(0);
    await expect(page.locator(".ro-item")).toHaveCount(3);
    await expect(page.getByText("לא סומן")).toHaveCount(3);
    await expect(page.getByRole("button", { name: /הפעלת סרטון יום 2/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "חזרה לשביל" })).toHaveAttribute("href", "/path");
    await expect(page.getByRole("navigation", { name: "ניווט ראשי" }).getByRole("link", { name: "השביל" })).toHaveAttribute("aria-current", "page");
    await axe(page);
    await shot(page, "day-past-view-only");
    await ctx.close();
  });

  test("older day that was counted: 'נספר' and the marked action", async ({ browser }) => {
    await seed([[2, "move"]]);
    const { ctx, page } = await open(browser, T.day4Noon, "/day/2");
    await expect(page.locator(".eyebrow-s")).toHaveText("נספר");
    await expect(page.getByText("יום 2 נספר. הסימון נסגר, ואפשר לצפות בסרטון.")).toBeVisible();
    await expect(page.locator('.ro-item[data-marked="true"]')).toContainText("תנועה");
    await expect(page.getByText("סומן", { exact: true })).toHaveCount(1);
    await axe(page);
    await ctx.close();
  });

  test("yesterday: markable until midnight, saved, toggles back, axe", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.day4Noon, "/day/3");
    await expect(page.locator(".eyebrow-s")).toHaveText("אפשר לסמן עד חצות");
    const habit = page.getByRole("button", { name: /^הרגל/ });
    await expect(habit).toHaveAttribute("aria-pressed", "false");
    await axe(page);
    await shot(page, "day-yesterday-markable");
    await habit.click();
    await expect(habit).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".toast-region")).toContainText("נשמר");
    await expect.poll(countRows).toBe(1);
    await shot(page, "day-yesterday-marked");
    await axe(page);
    await page.keyboard.press("Space");
    await expect(habit).toHaveAttribute("aria-pressed", "false");
    await expect.poll(countRows).toBe(0);
    // after midnight the same page rejects the mark (server clock), and 00:30 shows it read-only
    await ctx.setExtraHTTPHeaders(clock(T.day5Night));
    await habit.click();
    await expect(page.getByText("הסימון לא נשמר. אפשר לנסות שוב.")).toBeVisible();
    expect(await countRows()).toBe(0);
    await page.goto("/day/3");
    await expect(page.getByRole("button", { name: /^הרגל/ })).toHaveCount(0);
    await expect(page.locator(".eyebrow-s")).toHaveText("לא נספר");
    await ctx.close();
  });

  test("live yesterday (day 6 → 7 at 10:00): habit and live are the actions on day 7's yesterday", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, "2026-12-08T10:00:00+02:00", "/day/7");
    await expect(page.getByRole("button", { name: /^לייב עם אביטל/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^תנועה/ })).toHaveCount(0);
    await page.getByRole("button", { name: /^לייב עם אביטל/ }).click();
    await expect.poll(countRows).toBe(1);
    await ctx.close();
  });

  test("the current day redirects to /today", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.day4Noon, "/day/4");
    await expect(page).toHaveURL(/\/today$/);
    await ctx.close();
  });

  test("tomorrow: locked screen with the previous-day line, links, axe", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.day4Noon, "/day/5");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("יום 5 נפתח מחר בבוקר");
    await expect(page.getByText("הסרטון והפעולות יופיעו כאן ב־05:00.", { exact: false })).toBeVisible();
    await expect(page.getByRole("img", { name: "נפתח מחר בבוקר ב־05:00" })).toBeVisible();
    await expect(page.getByText("את יום 3 אפשר לסמן עד חצות")).toBeVisible();
    await expect(page.getByRole("link", { name: "חזרה להיום" })).toHaveAttribute("href", "/today");
    await expect(page.getByRole("link", { name: "לצפייה בימים קודמים" })).toHaveAttribute("href", "/path");
    await expect(page.getByText("הימים נפתחים בשעה קבועה, בכל בוקר, לפי שעון ישראל.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^(הרגל|תנועה|מדיטציה)/ })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "ניווט ראשי" }).getByRole("link", { name: "השביל" })).toHaveAttribute("aria-current", "page");
    await axe(page);
    await shot(page, "day-locked-tomorrow");
    await ctx.close();
  });

  test("tomorrow at 00:30 (yesterday closed): no previous-day line", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.day5Night, "/day/5");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("יום 5 נפתח מחר בבוקר");
    await expect(page.getByText(/אפשר לסמן עד חצות/)).toHaveCount(0);
    await ctx.close();
  });

  test("far future: its own copy, no previous-day line, axe", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.day4Noon, "/day/9");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("יום 9 עוד לא נפתח");
    await expect(page.getByText("כל בוקר ב־05:00 נפתח יום אחד. אפשר לחזור מחר.")).toBeVisible();
    await expect(page.getByText(/אפשר לסמן עד חצות/)).toHaveCount(0);
    await axe(page);
    await shot(page, "day-locked-far");
    await ctx.close();
  });

  test("before start: the challenge-starts copy, axe", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.beforeStart, "/day/3");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("האתגר מתחיל ב");
    await axe(page);
    await shot(page, "day-locked-before-start");
    await ctx.close();
  });

  test("320px: locked and open day, no horizontal scroll, axe", async ({ browser }) => {
    await seed([]);
    for (const [url, now] of [["/day/5", T.day4Noon], ["/day/3", T.day4Noon], ["/day/2", T.day4Noon]] as const) {
      const { ctx, page } = await open(browser, now, url, { width: 320 });
      const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(sw, url).toBeLessThanOrEqual(cw);
      await axe(page);
      await ctx.close();
    }
  });

  test("invalid day: a real 404 with the Hebrew not-found screen (no day content) for 0, 15, 07, text, decimals", async ({ browser }) => {
    await seed([]);
    const ctx = await browser.newContext({ storageState, extraHTTPHeaders: clock(T.day4Noon), locale: "he-IL" });
    for (const bad of ["0", "15", "01", "07", "-1", "abc", "1.5", "7.0", "1e1", "99", "99999999999999999999", "%20", "%2537"]) {
      const page = await ctx.newPage();
      const res = await page.goto(`/day/${bad}`);
      expect(res!.status(), bad).toBe(404);
      await expect(page.getByRole("heading", { level: 1 }), bad).toHaveText("הדף לא נמצא");
      await expect(page.getByRole("button", { name: /הפעלת סרטון/ }), bad).toHaveCount(0);
      await expect(page.locator('meta[name="robots"]').first(), bad).toHaveAttribute("content", /noindex/);
      await page.close();
    }
    await expect(async () => {
      const ok = await ctx.newPage();
      await ok.goto("/day/3");
      await expect(ok.getByRole("heading", { level: 1 })).toHaveText("יום 3");
      await ok.close();
    }).toPass();
    // a percent-encoded digit is the same day as the plain one (Next decodes the param)
    const enc = await ctx.newPage();
    expect((await enc.goto("/day/%37"))!.status()).toBe(200);
    await expect(enc.getByRole("heading", { level: 1 })).toHaveText("יום 7 עוד לא נפתח");
    await enc.close();
    // signed out: the same 404 (the check needs no session and reveals nothing about the user)
    const anon = await browser.newContext({ locale: "he-IL" });
    expect((await anon.request.get("/day/0")).status()).toBe(404);
    // unknown pages get the Hebrew 404 too
    const live = await anon.newPage();
    expect((await live.goto("/no-such-page"))!.status()).toBe(404);
    await expect(live.getByRole("heading", { level: 1 })).toHaveText("הדף לא נמצא");
    await expect(live.locator("html")).toHaveAttribute("lang", "he");
    await axe(live);
    await anon.close();
    const page = await ctx.newPage();
    await page.goto("/day/15");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("הדף לא נמצא");
    await expect(page.getByRole("link", { name: "חזרה להיום" })).toHaveAttribute("href", "/today");
    await axe(page);
    await ctx.close();
  });

  test("CSP: every inline script on /path and /day/[n] carries this request's nonce", async ({ browser }) => {
    await seed([]);
    const ctx = await browser.newContext({ storageState, extraHTTPHeaders: clock(T.day4Noon) });
    for (const url of ["/path", "/day/3", "/day/5"]) {
      const res = await ctx.request.get(url);
      const nonce = /'nonce-([^']+)'/.exec(res.headers()["content-security-policy"] ?? "")?.[1];
      expect(nonce, url).toBeTruthy();
      const html = await res.text();
      const scripts = html.match(/<script\b[^>]*>/g) ?? [];
      expect(scripts.length).toBeGreaterThan(0);
      for (const tag of scripts) expect(tag, `${url} ${tag}`).toContain(`nonce="${nonce}"`);
    }
    await ctx.close();
  });

  test("requires a session: signed-out visitors land on the login page", async ({ browser }) => {
    for (const url of ["/day/3", "/day/5", "/path"]) {
      const ctx = await browser.newContext({ extraHTTPHeaders: clock(T.day4Noon) });
      const page = await ctx.newPage();
      await page.goto(url);
      await page.waitForURL("**/login**");
      await ctx.close();
    }
  });
});

test.describe("locked days never leak their content", () => {
  /** כותרות של יום שלא מופיעות באף יום אחר (כדי שהבדיקה לא תיכשל על טקסט משותף). */
  const uniqueTitles = (day: number) => {
    const others = DAYS.filter((d) => d.day !== day).flatMap((d) => [d.habit.title, d.movement.title, d.meditation.title]);
    const d = DAYS[day - 1];
    return [d.habit.title, d.movement.title, d.meditation.title].filter((t) => !others.includes(t));
  };

  async function collect(page: Page, url: string) {
    const scripts: string[] = [];
    page.on("response", async (r) => {
      if (r.request().resourceType() === "script") scripts.push(await r.text().catch(() => ""));
    });
    const res = await page.goto(url);
    await page.waitForLoadState("networkidle");
    return { html: await res!.text(), scripts: scripts.join("\n") };
  }

  for (const [day, name] of [[5, "tomorrow"], [9, "far future"]] as const) {
    test(`day ${day} (${name}): HTML, RSC data and scripts carry no titles or video ids`, async ({ browser }) => {
      await seed([]);
      const titles = uniqueTitles(day);
      expect(titles.length).toBeGreaterThanOrEqual(2);
      const { ctx, page } = await open(browser, T.day4Noon, `/day/${day}`);
      const { html, scripts } = await collect(page, `/day/${day}`);
      for (const t of titles) {
        expect(html, `HTML has "${t}"`).not.toContain(t);
        expect(scripts, `JS has "${t}"`).not.toContain(t);
      }
      expect(html, "opening line").not.toContain(DAYS[day - 1].opening);
      expect(scripts, "opening line in JS").not.toContain(DAYS[day - 1].opening);
      expect(html).not.toContain("e2evid");
      expect(html).not.toContain("mediadelivery");
      expect(html).not.toContain("iframe");
      await ctx.close();
    });
  }

  test("before start: no day content in a locked day's HTML", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, T.beforeStart, "/day/2");
    const { html } = await collect(page, "/day/2");
    for (const t of uniqueTitles(2)) expect(html).not.toContain(t);
    await ctx.close();
  });

  test("the Today and Path pages do not ship locked days' titles to the browser", async ({ browser }) => {
    await seed([]);
    for (const url of ["/today", "/path"]) {
      const { ctx, page } = await open(browser, T.day4Noon, url);
      const { html, scripts } = await collect(page, url);
      for (const day of [5, 6, 9, 14]) {
        for (const t of uniqueTitles(day)) {
          expect(html, `${url} HTML has day ${day} "${t}"`).not.toContain(t);
          expect(scripts, `${url} JS has day ${day} "${t}"`).not.toContain(t);
        }
      }
      await ctx.close();
    }
  });

  test("the video route still refuses a locked day", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState, extraHTTPHeaders: clock(T.day4Noon) });
    expect((await ctx.request.get("/api/video/5")).status()).toBe(403);
    await ctx.close();
  });
});
