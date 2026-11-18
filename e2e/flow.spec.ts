import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { axe, createUser, expectReflowAndTargets, open, overflowingElements, pool, T, type Session } from "./helpers";

/**
 * The "soft flow" look (2026-11-18): Today with the long/short practice choice and the water cup, the path as a stream,
 * the live evening scene. Checks axe, reflow and targets at 390px and 320px, and that motion stops with reduced motion.
 * FLOW_SHOTS=<dir> saves full-page screenshots (deviceScaleFactor 2) for the PR.
 */
const SHOTS = process.env.FLOW_SHOTS;
async function full(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(1400);
  // a full-page shot would print the fixed nav over the middle of the page: put it at the end for the picture only
  await page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>(".bnav");
    if (nav) Object.assign(nav.style, { position: "static", marginTop: "16px" });
  });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

let s: Session;
async function seed(rows: Array<[number, string]>) {
  await pool.query("delete from action_completions where user_id = $1", [s.userId]);
  await pool.query("delete from habit_checks where user_id = $1", [s.userId]);
  for (const [day, action] of rows) await pool.query("insert into action_completions (user_id, day, action) values ($1, $2, $3)", [s.userId, day, action]);
}

test.beforeAll(async ({ browser }) => {
  s = await createUser(browser, "flow");
});

test("today: long/short choice, the water cup, soft marks", async ({ browser }) => {
  for (const width of [390, 320]) {
    await seed([[1, "habit"], [1, "move"], [1, "meditate"], [2, "habit"], [2, "move"], [3, "habit"], [4, "habit"]]);
    const { ctx, page } = await open(browser, s, T.day4Noon, "/today", { width });
    const choice = page.getByRole("group", { name: "אורך התרגול" });
    await expect(choice).toBeVisible();
    await expect(choice.getByRole("radio", { name: /התרגול המלא/ })).toBeChecked();
    await expect(page.getByRole("img", { name: /חצי/ }).first()).toBeVisible();
    expect(await overflowingElements(page)).toEqual([]);
    await axe(page);
    await expectReflowAndTargets(page);
    await full(page, `today-${width}`);
    if (width === 390) {
      await choice.getByRole("radio", { name: /התרגול הקצר/ }).check();
      await expect(choice.getByRole("radio", { name: /התרגול הקצר/ })).toBeChecked();
      await page.locator('[data-action-key="4:move"]').click();
      await expect(page.locator('[data-action-key="4:move"]')).toHaveAttribute("aria-pressed", "true");
      await full(page, "today-short-move-390");
    }
    await ctx.close();
  }
});

test("path: the stream with cups on stones", async ({ browser }) => {
  await seed([[1, "habit"], [2, "habit"], [2, "move"], [3, "habit"], [4, "habit"], [4, "move"], [4, "meditate"], [6, "habit"], [7, "habit"], [7, "live"], [8, "habit"], [8, "move"], [9, "habit"]]);
  for (const width of [390, 320]) {
    const { ctx, page } = await open(browser, s, "2026-12-10T12:00:00+02:00", "/path", { width });
    await expect(page.locator(".map-current")).toHaveCount(1);
    expect(await overflowingElements(page)).toEqual([]);
    await axe(page);
    await expectReflowAndTargets(page);
    await full(page, `path-${width}`);
    await ctx.close();
  }
});

test("live: the evening scene, join on a forest stone", async ({ browser }) => {
  await seed([]);
  for (const width of [390, 320]) {
    const { ctx, page } = await open(browser, s, T.day7InSession, "/live", { width });
    await expect(page.locator(".lv-join--on")).toBeVisible();
    expect(await overflowingElements(page)).toEqual([]);
    await axe(page);
    await expectReflowAndTargets(page);
    await full(page, `live-${width}`);
    await ctx.close();
  }
});

test("reduced motion: the water, the sun and the stream stand still", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, T.day4Noon, "/today", { reducedMotion: true });
  const anim = await page.evaluate(() =>
    [".cup-svg .wave", ".hero-sun"].map((sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).animationName : "missing";
    }),
  );
  expect(anim).toEqual(["none", "none"]);
  await ctx.close();
});
