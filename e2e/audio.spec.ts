import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { SHOTS, axe, createUser, expectReflowAndTargets, open, type Session } from "./helpers";

/** תרגול מלא/קצר ונגן השמע של המדיטציה, מתחת לסרטון (Today ו־/day/N). */
let s: Session;
test.beforeAll(async ({ browser }) => {
  s = await createUser(browser, "audio");
});

async function shotAt(page: import("@playwright/test").Page, name: string, width: number) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => {
    document.querySelector(".video-len")!.scrollIntoView({ block: "start" });
    window.scrollBy(0, -90);
  });
  await page.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
}

for (const width of [320, 390]) {
  test(`day 4 at ${width}px: long/short choice and the meditation player, axe, no h-scroll`, async ({ browser }) => {
    const { ctx, page } = await open(browser, s, "2026-12-04T14:00:00+02:00", "/today", { width, reducedMotion: true });
    const group = page.getByRole("group", { name: "כמה זמן יש לכם היום?" });
    await expect(group).toBeVisible();
    await expect(group.getByRole("radio", { name: /התרגול המלא/ })).toBeChecked();
    await expect(group).toContainText("כ־5 דקות");
    await expect(page.getByRole("heading", { name: "המדיטציה של היום" })).toBeVisible();
    const audio = page.locator("audio");
    await expect(audio).toHaveAttribute("aria-label", "הקלטת המדיטציה של יום 4");
    await expect(audio).toHaveAttribute("preload", "none");
    await expect(audio).toHaveAttribute("src", "/api/audio/4");
    await axe(page);
    await expectReflowAndTargets(page);
    await shotAt(page, "today-day4", width);
    await ctx.close();
  });

  test(`day 2 at ${width}px: no recording yet shows a pending note, no player`, async ({ browser }) => {
    const { ctx, page } = await open(browser, s, "2026-12-04T14:00:00+02:00", "/day/2", { width, reducedMotion: true });
    await expect(page.getByText("ההקלטה תעלה לכאן בקרוב.")).toBeVisible();
    await expect(page.locator("audio")).toHaveCount(0);
    await axe(page);
    await shotAt(page, "day2-pending", width);
    await ctx.close();
  });
}

test("live day 7: no meditation tile", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, "2026-12-07T10:00:00+02:00", "/today");
  await expect(page.getByRole("heading", { name: "המדיטציה של היום" })).toHaveCount(0);
  await ctx.close();
});

test("audio route: signed redirect for an open day, refused when locked, empty or signed out", async ({ browser }) => {
  const { ctx } = await open(browser, s, "2026-12-04T14:00:00+02:00", "/today");
  const ok = await ctx.request.get("/api/audio/4", { maxRedirects: 0 });
  expect(ok.status()).toBe(302);
  expect(ok.headers()["location"]).toMatch(/^https:\/\/e2e-audio\.b-cdn\.net\/med\/day04\.mp3\?token=[A-Za-z0-9_-]+&expires=\d+$/);
  expect(ok.headers()["cache-control"]).toContain("no-store");
  expect((await ctx.request.get("/api/audio/9", { maxRedirects: 0 })).status()).toBe(403);
  expect((await ctx.request.get("/api/audio/2", { maxRedirects: 0 })).status()).toBe(404);
  await ctx.close();
  const anon = await browser.newContext();
  expect((await anon.request.get("/api/audio/4", { maxRedirects: 0 })).status()).toBe(401);
  await anon.close();
});

test("CSP allows the audio host in media-src only", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, "2026-12-04T14:00:00+02:00", "/today");
  const res = await page.request.get("/today");
  const csp = res.headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/media-src 'self' blob: https:\/\/e2e-audio\.b-cdn\.net/);
  expect(csp).not.toMatch(/img-src[^;]*e2e-audio/);
  await ctx.close();
});
