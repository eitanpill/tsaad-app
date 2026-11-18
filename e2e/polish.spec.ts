import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { axe, createUser, expectReflowAndTargets, open, overflowingElements, pool, type Session } from "./helpers";

/**
 * Polish round for the later days (walkthrough 2026-11-18): "ההרגלים שלי" newest first, all open, self-report action buttons ("עשיתי"),
 * the opening invite only before starting, the locked-day date, day-14 wording, the Yesodot card after the window,
 * and the Avital photo fallback. START_DATE=2026-12-01 (day N opens 05:00 on 2026-12-N).
 * POLISH_SHOTS=<dir> also saves full-page screenshots at 390px (and a few at 320px) for the PR.
 */
const A = "http://localhost:3100";
const B = "http://localhost:3101";
const SHOTS = process.env.POLISH_SHOTS;
async function full(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

const TT = {
  day4Morning: "2026-12-04T08:00:00+02:00",
  day4Evening: "2026-12-04T21:00:00+02:00",
  day13: "2026-12-13T09:00:00+02:00",
  day14Morning: "2026-12-14T09:00:00+02:00",
  day14Late: "2026-12-14T22:30:00+02:00",
  offerExpired: "2026-12-16T21:01:00+02:00",
};
const INVITE = "קחו נשימה אחת איתי, ומתחילים.";

let s: Session;
async function seed(rows: Array<[number, string]>) {
  await pool.query("delete from action_completions where user_id = $1", [s.userId]);
  await pool.query("delete from habit_checks where user_id = $1", [s.userId]);
  for (const [day, action] of rows) await pool.query("insert into action_completions (user_id, day, action) values ($1, $2, $3)", [s.userId, day, action]);
}
const habits = (days: number[]): Array<[number, string]> => days.map((d) => [d, "habit"]);

test.describe("server A", () => {
  test.use({ baseURL: A });
  test.beforeAll(async ({ browser }) => {
    s = await createUser(browser, "pol");
  });

  test("habit list: newest first, all habits open (no cap, no toggle)", async ({ browser }) => {
    await seed(habits([1, 2, 3, 4, 6, 7, 8, 10, 11, 12]));
    const { ctx, page } = await open(browser, s, TT.day13, "/today");
    const list = page.locator(".t-habits .habit-list");
    await expect(list.locator("> li")).toHaveCount(13);
    await expect(list.locator("> li").first()).toContainText("חדש היום");
    await expect(page.locator(".habits-more")).toHaveCount(0);
    await expect(page.locator(".t-habits .habits-count")).toHaveText("0 מתוך 13 הרגלים");
    await axe(page);
    await expectReflowAndTargets(page);
    await full(page, "after-day13-today");
    await ctx.close();
    const narrow = await open(browser, s, TT.day13, "/today", { width: 320 });
    expect(await overflowingElements(narrow.page)).toEqual([]);
    await full(narrow.page, "after-day13-today-320");
    await narrow.ctx.close();
  });

  test("action buttons read as self-report marks, and say the practice is in the video", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, s, TT.day4Morning, "/today");
    await expect(page.getByRole("heading", { level: 2, name: "מה עשיתי היום" })).toBeVisible();
    await expect(page.getByText("התנועה והמדיטציה נמצאות בסרטון של היום. אחרי שעשיתם, מסמנים כאן.")).toBeVisible();
    for (const a of ["habit", "move", "meditate"]) {
      const b = page.locator(`[data-action-key="4:${a}"]`);
      await expect(b).toContainText("עשיתי");
      await expect(b).toHaveAttribute("aria-pressed", "false");
    }
    // the opening invite shows in the morning before anything is marked
    await expect(page.locator("p.opening")).toContainText(INVITE);
    await full(page, "after-day4-morning");
    await page.locator('[data-action-key="4:move"]').click();
    await expect(page.locator('[data-action-key="4:move"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-action-key="4:move"]')).toContainText("עשיתי");
    await expect(page.locator("p.opening")).not.toContainText(INVITE);
    await axe(page);
    await expectReflowAndTargets(page);
    await ctx.close();
  });

  test("evening: no 'ומתחילים'", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, s, TT.day4Evening, "/today");
    await expect(page.locator("p.opening")).toHaveText("יום 4. ההרגל של היום: 7 דקות אמבטיית שמש.");
    await ctx.close();
  });

  test("past day: the opening line without the invite", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, s, TT.day13, "/day/5");
    await expect(page.locator("p.opening")).not.toContainText(INVITE);
    await ctx.close();
  });

  test("locked day far ahead names its date, never 'tomorrow'", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, s, TT.day4Morning, "/day/12");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("יום 12 נפתח ביום שבת, 12 בדצמבר");
    await expect(page.getByText("מחר")).toHaveCount(0);
    await axe(page);
    await full(page, "after-day12-locked");
    await ctx.close();
  });

  test("day 14 morning: the offer tile says it opens after the closing live", async ({ browser }) => {
    await seed(habits([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]));
    const { ctx, page } = await open(browser, s, TT.day14Morning, "/today");
    await expect(page.locator(".t-entry h2")).toHaveText("ההצעה תופיע כאן אחרי מפגש הסיום");
    await expect(page.getByText("ביום 14", { exact: false }).first()).toBeVisible();
    // last day: no "you can continue until day 14"
    await expect(page.locator(".t-progress-note")).toHaveCount(0);
    await full(page, "after-day14-morning");
    await ctx.close();
  });

  test("landing: Avital tile has the decorative fallback, no image", async ({ page }) => {
    await page.goto("/tsaad");
    const fb = page.getByTestId("avital-fallback");
    await expect(fb).toBeVisible();
    await expect(fb).toHaveAttribute("aria-hidden", "true");
    await axe(page);
    await fb.scrollIntoViewIfNeeded();
    if (SHOTS) await page.locator("section[aria-labelledby=land-av-h]").screenshot({ path: `${SHOTS}/after-landing-avital.png` });
  });
});

test.describe("server B (day 14 live at 20:00, 48h window)", () => {
  test.use({ baseURL: B });
  test.beforeAll(async ({ browser }) => {
    s = await createUser(browser, "polb");
  });

  test("day 14 after the live: greeting instead of 'there is a live today', no invite, no 'continue until day 14'", async ({ browser }) => {
    await seed([...habits([1, 2, 3, 4, 6, 7, 8, 10, 11, 12, 13, 14]), [14, "live"]]);
    const { ctx, page } = await open(browser, s, TT.day14Late, "/today");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ערב טוב, בדיקה");
    await expect(page.getByText("היום יש מפגש לייב עם אביטל")).toHaveCount(0);
    await expect(page.locator("p.opening")).not.toContainText(INVITE);
    await expect(page.getByText("אפשר להמשיך עד יום 14.")).toHaveCount(0);
    await full(page, "after-day14-evening");
    await ctx.close();
  });

  test("offer open: 'three options' and three cards", async ({ browser }) => {
    await seed([]);
    const { ctx, page } = await open(browser, s, "2026-12-15T10:00:00+02:00", "/offer");
    await expect(page.getByText("שלוש אפשרויות. אפשר לבחור אחת, או לא לבחור.")).toBeVisible();
    await expect(page.locator("section.t-ofr")).toHaveCount(3);
    await full(page, "after-offer-open");
    await ctx.close();
  });

  test("after the 48h window: no Yesodot card and no 1,265", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, TT.offerExpired, "/offer");
    await expect(page.getByText("ההצעה הסתיימה.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "יסודות היוגה" })).toHaveCount(0);
    expect(await page.content()).not.toContain("1,265");
    await axe(page);
    await full(page, "after-offer-expired");
    await ctx.close();
  });
});
