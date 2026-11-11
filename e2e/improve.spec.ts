import { expect, test } from "@playwright/test";
import { axe, createUser, expectReflowAndTargets, open, overflowingElements, pool, type Session } from "./helpers";

/**
 * Improvement round: path strip, cup animation and celebration, completion state, before-start welcome, share card,
 * logout on /account, desktop layouts, reduced motion, and a 195px (200% zoom) check on every changed state.
 * START_DATE=2026-12-01 (day N opens 05:00 on 2026-12-N); the user's display name is "בדיקה" (a clean first name).
 */
const T = {
  beforeStart: "2026-11-27T12:00:00+02:00",
  day1: "2026-12-01T08:00:00+02:00",
  day4: "2026-12-04T14:00:00+02:00",
  day12: "2026-12-12T10:00:00+02:00",
  ended: "2026-12-16T10:00:00+02:00",
};

let s: Session;
test.beforeAll(async ({ browser }) => {
  s = await createUser(browser, "imp");
});

async function seed(rows: Array<[number, string]>) {
  await pool.query("delete from action_completions where user_id = $1", [s.userId]);
  for (const [day, action] of rows) await pool.query("insert into action_completions (user_id, day, action) values ($1, $2, $3)", [s.userId, day, action]);
}
const habits = (days: number[]): Array<[number, string]> => days.map((d) => [d, "habit"]);
const waterStyle = (page: import("@playwright/test").Page) => page.locator(".t-cup .cup-water").getAttribute("style");

test.describe("path strip", () => {
  test("one link to /path whose name summarises progress; today highlighted; axe", async ({ browser }) => {
    await seed(habits([1, 2, 3]));
    const { ctx, page } = await open(browser, s, T.day4, "/today");
    const link = page.getByRole("link", { name: "יום 4 מתוך 14, 3 ימים נספרו" });
    await expect(link).toHaveAttribute("href", "/path");
    await expect(page.locator(".sstone--today")).toHaveCount(1);
    await expect(page.locator(".sstone--counted")).toHaveCount(3);
    await expect(page.locator(".sstone--locked")).toHaveCount(10);
    await axe(page);
    await expectReflowAndTargets(page);
    await ctx.close();
  });
});

test.describe("cup and celebration", () => {
  test("water rises on each mark, a full cup sparkles, it is announced, and focus stays on the button", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, s, T.day4, "/today");
    const before = await waterStyle(page);
    await page.locator('[data-action-key="4:habit"]').click();
    await expect.poll(() => waterStyle(page)).not.toBe(before);
    expect(await page.locator(".cup-burst").count()).toBe(0);
    await page.locator('[data-action-key="4:move"]').click();
    await expect(page.locator('[data-action-key="4:move"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-action-key="4:meditate"]').click();
    await expect(page.getByRole("img", { name: "הכוס של היום, מלאה" })).toBeVisible();
    await expect(page.locator(".cup-burst")).toHaveCount(1);
    await expect(page.locator(".toast-region")).toContainText("הכוס מלאה.");
    // focus was never moved by the celebration
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-action-key"))).toBe("4:meditate");
    await axe(page);
    await ctx.close();
  });

  test("reduced motion: no transition, no animation, state still clear", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, s, T.day4, "/today", { reducedMotion: true });
    for (const a of ["habit", "move", "meditate"]) {
      await page.locator(`[data-action-key="4:${a}"]`).click();
      await expect(page.locator(`[data-action-key="4:${a}"]`)).toHaveAttribute("aria-pressed", "true");
    }
    await expect(page.getByRole("img", { name: "הכוס של היום, מלאה" })).toBeVisible();
    await expect(page.locator(".cup-burst .sp").first()).toBeAttached();
    const m = await page.evaluate(() => {
      const w = getComputedStyle(document.querySelector(".cup-water")!);
      const sp = document.querySelector(".cup-burst .sp");
      const g = getComputedStyle(document.querySelector(".sstone--today .sstone-dot")!);
      return { t: w.transitionDuration, sp: sp ? { a: getComputedStyle(sp).animationName, o: getComputedStyle(sp).opacity } : null, g: g.animationName };
    });
    expect(m.t).toBe("0s");
    expect(m.sp).toEqual({ a: "none", o: "0" });
    expect(m.g).toBe("none");
    await expect(page.locator(".toast-region")).toContainText("הכוס מלאה.");
    await ctx.close();
  });

  test("reaching 12 counted days shows the completion state in place, announced, without moving focus", async ({ browser }) => {
    await seed(habits([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
    const { ctx, page } = await open(browser, s, T.day12, "/today");
    await expect(page.getByRole("heading", { name: "האתגר הושלם" })).toHaveCount(0);
    await page.locator('[data-action-key="12:habit"]').click();
    await expect(page.getByRole("heading", { level: 2, name: "האתגר הושלם" })).toBeVisible();
    await expect(page.locator(".t-map")).toBeVisible();
    await expect(page.locator(".toast-region")).toContainText("האתגר הושלם. תודה שהייתם איתנו.");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-action-key"))).toBe("12:habit");
    await expect(page.getByRole("link", { name: "לצפייה בהצעות" })).toHaveCount(0); // the offer is not open on day 12
    await axe(page);
    await ctx.close();
  });
});

test.describe("share card", () => {
  test("the image route returns a PNG, rejects bad masks, and the button shares the file when the browser can", async ({ browser, request }) => {
    const ok = await request.get("/api/share-card?m=16383");
    expect(ok.status()).toBe(200);
    expect(ok.headers()["content-type"]).toBe("image/png");
    expect((await ok.body()).subarray(1, 4).toString()).toBe("PNG");
    for (const bad of ["", "?m=abc", "?m=16384", "?m=-1"]) expect((await request.get(`/api/share-card${bad}`)).status()).toBe(400);

    await seed(habits([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
    const { ctx, page } = await open(browser, s, T.day12, "/today", {
      init: () => {
        const w = window as unknown as { __shared: unknown };
        Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
        Object.defineProperty(navigator, "share", {
          value: async (d: { files: File[]; text: string }) => {
            w.__shared = { n: d.files.length, type: d.files[0].type, size: d.files[0].size, text: d.text };
          },
          configurable: true,
        });
      },
    });
    await page.getByRole("button", { name: "שתפו" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: unknown }).__shared)).toMatchObject({ n: 1, type: "image/png", text: "השלמתי 14 ימים של צעד קטן ביום" });
    await expect(page.getByRole("link", { name: "להורדת התמונה" })).toHaveAttribute("href", "/api/share-card?m=4095");
    await ctx.close();
  });
});

test.describe("before the start", () => {
  test("welcome: days to the start, the three parts, links to reminders and install, no video; axe", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, T.beforeStart, "/today");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("האתגר מתחיל ב");
    await expect(page.locator(".t-count")).toContainText("4");
    await expect(page.locator(".t-count")).toContainText("ימים עד ההתחלה");
    await expect(page.getByRole("heading", { level: 2, name: "מה מחכה בכל יום" })).toBeVisible();
    for (const t of ["הרגל", "תנועה", "מדיטציה"]) await expect(page.locator(".expect-list")).toContainText(t);
    await expect(page.getByRole("link", { name: "להפעלת תזכורות" })).toHaveAttribute("href", "/reminders");
    await expect(page.getByRole("link", { name: "להוספה למסך הבית" })).toHaveAttribute("href", "/install");
    await expect(page.locator("iframe, .t-video, .play")).toHaveCount(0);
    await axe(page);
    await expectReflowAndTargets(page);
    await ctx.close();
  });
  test("the day before: 'tomorrow'", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, "2026-11-30T12:00:00+02:00", "/today");
    await expect(page.locator(".t-count")).toHaveText("מחר מתחילים");
    await ctx.close();
  });
});

test.describe("account and logout", () => {
  test("no logout on /today; /account has it (and the footer link leads there)", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, T.day4, "/today");
    await expect(page.getByRole("button", { name: "יציאה" })).toHaveCount(0);
    await page.getByRole("link", { name: "החשבון שלי" }).click();
    await page.waitForURL("**/account");
    await expect(page.getByRole("button", { name: "יציאה" })).toBeVisible();
    await axe(page);
    await ctx.close();
  });
});

test.describe("hero", () => {
  test("greets by first name; the habit title is not repeated in the heading", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, s, T.day1, "/today");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("בוקר טוב, בדיקה");
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText("מים חמימים");
    await expect(page.locator("p.opening")).toContainText("כוס מים חמימים");
    await ctx.close();
  });
  test("a username used as the display name gets no name in the greeting", async ({ browser }) => {
    await pool.query("update users set display_name = username where id = $1", [s.userId]);
    const { ctx, page } = await open(browser, s, T.day1, "/today");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("בוקר טוב");
    await pool.query("update users set display_name = 'בדיקה' where id = $1", [s.userId]);
    await ctx.close();
  });
});

test.describe("desktop (1280px)", () => {
  test("login uses a second column; Today uses two columns; axe and no overflow", async ({ browser }) => {
    const anon = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "he-IL" });
    const lp = await anon.newPage();
    await lp.goto("/login");
    await expect(lp.locator(".auth-art")).toBeVisible();
    await axe(lp);
    expect(await lp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await lp.setViewportSize({ width: 390, height: 800 });
    await expect(lp.locator(".auth-art")).toBeHidden();
    await anon.close();

    await seed(habits([1, 2, 3]));
    const { ctx, page } = await open(browser, s, T.day4, "/today", { width: 1280 });
    const x = await page.evaluate(() => ({ v: document.querySelector(".t-video")!.getBoundingClientRect(), c: document.querySelector(".t-cup")!.getBoundingClientRect() }));
    expect(Math.abs(x.v.top - x.c.top)).toBeLessThan(2); // side by side
    expect(x.v.width).toBeGreaterThan(500);
    await axe(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await ctx.close();
  });
});

test.describe("200% zoom (195px) on every changed state", () => {
  const cases: Array<[string, string, string, Array<[number, string]>]> = [
    ["day 1", T.day1, "/today", []],
    ["day 4 with strip", T.day4, "/today", habits([1, 2, 3, 4])],
    ["completed", T.day12, "/today", habits([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])],
    ["ended, completed", T.ended, "/today", habits([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])],
    ["ended, none counted", T.ended, "/today", []],
    ["before start", T.beforeStart, "/today", []],
    ["account", T.day4, "/account", []],
  ];
  for (const [label, now, url, rows] of cases) {
    test(label, async ({ browser }) => {
      await seed(rows);
      const { ctx, page } = await open(browser, s, now, url, { width: 195 });
      expect(await overflowingElements(page)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      await axe(page);
      await ctx.close();
    });
  }
  test("login at 195px", async ({ browser }) => {
    const c = await browser.newContext({ viewport: { width: 195, height: 800 }, locale: "he-IL" });
    const p = await c.newPage();
    await p.goto("/login");
    expect(await overflowingElements(p)).toEqual([]);
    await c.close();
  });
});
