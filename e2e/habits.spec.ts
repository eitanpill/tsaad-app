import { expect, test } from "@playwright/test";
import { axe, createUser, expectReflowAndTargets, open, pool, type Session } from "./helpers";

/** "ההרגלים שלי": רשימת הרגלים מצטברת. START_DATE=2026-12-01 (יום N נפתח ב־05:00 ב־2026-12-N). */
const DAY1 = "2026-12-01T08:00:00+02:00";
const DAY3 = "2026-12-03T10:00:00+02:00";
const DAY3_LATE = "2026-12-03T23:50:00+02:00";


let s: Session;
test.beforeAll(async ({ browser }) => {
  s = await createUser(browser, "habits");
});


test("day 1 shows exactly one habit, marked as new", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, DAY1, "/today");
  await expect(page.getByRole("heading", { level: 2, name: "ההרגלים שלי" })).toBeVisible();
  const boxes = page.getByRole("checkbox");
  await expect(boxes).toHaveCount(1);
  await expect(page.getByRole("checkbox", { name: /כוס מים חמימים עם לימון כשקמים.*חדש היום/ })).toBeVisible();
  await expect(page.getByText("0 מתוך הרגל אחד")).toBeVisible();
  await ctx.close();
});

test("day 3 shows three habits, only the last is new; toggles persist after reload; keyboard only; axe clean", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, DAY3, "/today");
  await expect(page.getByRole("checkbox")).toHaveCount(3);
  await expect(page.getByText("חדש היום")).toHaveCount(1);
  await expect(page.getByRole("checkbox", { name: /חצי שעה בלי טלפון מרגע ההתעוררות.*חדש היום/ })).toBeVisible();
  await expectReflowAndTargets(page);
  await axe(page);

  // keyboard only: focus the first habit and press Space
  const first = page.getByRole("checkbox", { name: /כוס מים חמימים עם לימון/ });
  await first.focus();
  await expect(first).toBeFocused();
  await page.keyboard.press("Space");
  await expect(first).toBeChecked();
  await expect(page.getByRole("status").filter({ hasText: "נשמר. ההרגל סומן." })).toBeVisible();

  // older habit does not move the cup
  await expect(page.getByText("כוס ריקה")).toBeVisible();

  // the new habit IS the habit step: the cup fills and the existing habit button shows pressed
  const fresh = page.getByRole("checkbox", { name: /חצי שעה בלי טלפון מרגע ההתעוררות/ });
  await fresh.focus();
  await page.keyboard.press("Space");
  await expect(fresh).toBeChecked();
  await expect(page.getByRole("button", { pressed: true, name: /הרגל/ })).toBeVisible();
  await expect(page.locator(".t-cup")).toContainText("חצי כוס");
  await expect(page.getByRole("status").filter({ hasText: "היום נחשב" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("checkbox", { name: /כוס מים חמימים עם לימון/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /חצי שעה בלי טלפון/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /לסדר את המיטה/ })).not.toBeChecked();
  await expect(page.getByText("2 מתוך 3 הרגלים")).toBeVisible();
  await axe(page);

  // unticking via the existing habit button clears the checklist item (single source of truth)
  await page.getByRole("button", { pressed: true, name: /הרגל/ }).click();
  await expect(page.getByRole("checkbox", { name: /חצי שעה בלי טלפון/ })).not.toBeChecked();
  await ctx.close();
});

test("path shows 'X מתוך N הרגלים' per unlocked day", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, DAY3, "/path");
  await expect(page.getByRole("heading", { level: 2, name: "ההרגלים שלי בכל יום" })).toBeVisible();
  await expect(page.locator(".habit-counts li")).toHaveCount(3);
  await expect(page.locator('.habit-counts li[data-day="3"]')).toContainText("מתוך 3 הרגלים");
  await expect(page.locator('.habit-counts li[data-day="1"]')).toContainText("מתוך הרגל אחד");
  await axe(page);
  await ctx.close();
});

test("yesterday's list is editable until midnight; older days are read-only", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, "2026-12-04T10:00:00+02:00", "/day/3");
  await expect(page.getByRole("checkbox")).toHaveCount(3);
  await expect(page.getByText("חדש היום")).toHaveCount(0);
  await page.getByRole("checkbox", { name: /לסדר את המיטה/ }).check();
  await expect(page.getByRole("status").filter({ hasText: "נשמר. ההרגל סומן." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /לסדר את המיטה/ })).toBeChecked();
  await axe(page);
  await ctx.close();

  const old = await open(browser, s, "2026-12-05T10:00:00+02:00", "/day/3");
  await expect(old.page.getByRole("checkbox")).toHaveCount(0);
  await expect(old.page.getByText("הסימון של ההרגלים ביום 3 נסגר.")).toBeVisible();
  await expect(old.page.getByText("סומן").first()).toBeVisible();
  await axe(old.page);
  await old.ctx.close();
});

test("a closed day cannot be changed from the server either", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, DAY3_LATE, "/day/1");
  await expect(page.getByRole("checkbox")).toHaveCount(0); // day 1 is closed at this time
  await ctx.close();
  const rows = await pool.query(`select count(*)::int as n from habit_checks where user_id = $1 and day = 1`, [s.userId]);
  expect(rows.rows[0].n).toBe(0);
});

