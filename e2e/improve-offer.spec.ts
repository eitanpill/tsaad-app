import { expect, test } from "@playwright/test";
import { axe, createUser, expectReflowAndTargets, open, overflowingElements, pool, type Session } from "./helpers";

/** The end screen on server B (offer configured): summary, whole path, share, and the day-14 offers on the same screen. */
test.use({ baseURL: "http://localhost:3101" });

let s: Session;
test.beforeAll(async ({ browser }) => {
  s = await createUser(browser, "impo");
});

const OPEN = "2026-12-15T10:00:00+02:00"; // after day 14 (ended), inside the 48h offer window
const EXPIRED = "2026-12-17T10:00:00+02:00";

async function seed(rows: Array<[number, string]>) {
  await pool.query("delete from action_completions where user_id = $1", [s.userId]);
  for (const [day, action] of rows) await pool.query("insert into action_completions (user_id, day, action) values ($1, $2, $3)", [s.userId, day, action]);
}
const twelve: Array<[number, string]> = Array.from({ length: 11 }, (_, i) => [i + 1, "habit"]);
twelve.push([12, "habit"], [12, "move"], [14, "habit"], [14, "live"]);

test("after day 14 with the offer open: summary, path, share, and the offers inline", async ({ browser }) => {
  await seed(twelve);
  const { ctx, page } = await open(browser, s, OPEN, "/today");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("בוקר טוב, בדיקה");
  await expect(page.getByRole("heading", { level: 2, name: "האתגר הושלם" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "הימים שנספרו" })).toBeVisible();
  await expect(page.locator(".t-sum-days")).toContainText("1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14");
  await expect(page.locator(".t-sum-cups")).toContainText("כוס מלאה");
  await expect(page.locator(".t-map")).toBeVisible();
  await expect(page.getByRole("button", { name: "שתפו" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "פגישת זום אישית" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "ההמשך אחרי 14 הימים" })).toBeVisible();
  await expect(page.getByRole("link", { name: "לצפייה בהצעות" })).toHaveAttribute("href", "/offer");
  await axe(page);
  await expectReflowAndTargets(page);
  await ctx.close();
});

test("not completed: summary without the share button; offer expired falls back to the small entry tile", async ({ browser }) => {
  await seed([[1, "habit"], [2, "habit"]]);
  const { ctx, page } = await open(browser, s, EXPIRED, "/today");
  await expect(page.getByRole("button", { name: "שתפו" })).toHaveCount(0);
  await expect(page.locator(".t-sum-days")).toContainText("1, 2");
  await expect(page.getByRole("heading", { level: 2, name: "פגישת זום אישית" })).toHaveCount(0);
  await axe(page);
  await ctx.close();
});

test("195px: end screen with offers", async ({ browser }) => {
  await seed(twelve);
  const { ctx, page } = await open(browser, s, OPEN, "/today", { width: 195 });
  expect(await overflowingElements(page)).toEqual([]);
  await axe(page);
  await ctx.close();
});

test("desktop: finish screen in two columns", async ({ browser }) => {
  await seed(twelve);
  const { ctx, page } = await open(browser, s, OPEN, "/today", { width: 1280 });
  const r = await page.evaluate(() => ({ a: document.querySelector(".t-finish")!.getBoundingClientRect(), m: document.querySelector(".t-map")!.getBoundingClientRect() }));
  expect(r.a.left).not.toBe(r.m.left);
  await axe(page);
  await ctx.close();
});
