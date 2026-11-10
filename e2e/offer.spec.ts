import { expect, test } from "@playwright/test";
import { axe, clock, createUser, expectReflowAndTargets, open, overflowingElements, shot, type Session } from "./helpers";

/**
 * Stage 10 on server B (day 14 live at 20:00, window 48h, session and Yesodot links set, bundle link unset, contacts set).
 * Day 14 = 2026-12-14. The live ends 60 minutes after 20:00; the offer then stays open 48 hours (until 2026-12-16 21:00).
 * Yesodot has its own expiry (2026-12-20, through the end of that day).
 */
test.use({ baseURL: "http://localhost:3101" });

const TT = {
  liveRunning: "2026-12-14T20:30:00+02:00",
  open: "2026-12-14T21:30:00+02:00",
  lastMinute: "2026-12-16T20:59:00+02:00",
  expired: "2026-12-16T21:01:00+02:00",
  yesodotLastDay: "2026-12-20T23:00:00+02:00",
  yesodotExpired: "2026-12-21T10:00:00+02:00",
};

let s: Session;
test.beforeAll(async ({ browser }) => {
  s = await createUser(browser, "ofb");
});

test("offer is not yet open while the day-14 live runs, and no price or link is in the page", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, TT.liveRunning, "/offer");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ההצעה תופיע כאן ביום 14");
  const html = await page.content();
  for (const x of ["271 ₪", "139 ₪", "pay.example.test"]) expect(html).not.toContain(x);
  await axe(page);
  await ctx.close();
});

test("open: window text with the server deadline, session and bundle cards, Yesodot separate; UTM links; bundle disabled", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, TT.open, "/offer");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ההמשך אחרי 14 הימים");
  await expect(page.getByText(/ההצעה פתוחה 48 שעות מסוף הלייב, עד .*21:00\./)).toBeVisible();
  // no countdown: the page has no live-updating time element
  expect(await page.locator("main [aria-live], main time").count()).toBe(0);

  const session = page.getByRole("link", { name: "לקביעת הפגישה האישית בזום" });
  const href = new URL((await session.getAttribute("href"))!);
  expect(href.origin + href.pathname).toBe("https://pay.example.test/session271");
  expect(href.searchParams.get("ref")).toBe("app");
  expect(href.searchParams.get("utm_source")).toBe("tsaad_app");
  expect(href.searchParams.get("utm_medium")).toBe("app");
  expect(href.searchParams.get("utm_campaign")).toBe("session271");
  await expect(session).toHaveAttribute("rel", "noopener noreferrer");

  await expect(page.getByRole("heading", { level: 2, name: "פגישת זום אישית" })).toBeVisible();
  await expect(page.getByText("271 ₪")).toBeVisible();
  await expect(page.getByText("45 דקות עם אביטל. שיחה אישית והכוונה להמשך.")).toBeVisible();
  await expect(page.getByText("5 מקומות.")).toBeVisible(); // SESSION_SPOTS is set on this server only
  await expect(page.getByText("139 ₪")).toBeVisible();
  const bundle = page.getByRole("button", { name: "לפרטים ולהזמנה של הבאנדל" });
  await expect(bundle).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#ofr-bundle-note")).toHaveText("הכפתור יהיה פעיל כשהקישור יהיה מוכן.");

  const yes = page.getByRole("heading", { level: 2, name: "יסודות היוגה" });
  await expect(yes).toBeVisible();
  await expect(page.getByText("1,265 ₪")).toBeVisible();
  expect(await page.locator("main").innerText()).not.toMatch(/\[[A-Z_*0-9]+\]/);
  await expectReflowAndTargets(page);
  await shot(page, "offer-open");
  await axe(page);
  await ctx.close();
});

test("open offer at 200% browser zoom on a 390px phone (CSS viewport 195px): no horizontal scroll, CTAs fit", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: s.storageState, viewport: { width: 195, height: 422 }, deviceScaleFactor: 2, extraHTTPHeaders: clock(TT.open) });
  const page = await ctx.newPage();
  await page.goto("/offer");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ההמשך אחרי 14 הימים");
  expect(await overflowingElements(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  for (const el of await page.locator(".ofr-cta").all()) {
    const b = (await el.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(195.5);
  }
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/offer-open-zoom200-390.png`, fullPage: true });
  await ctx.close();
});

test("open until the last minute, then expired (server clock), Yesodot still its own", async ({ browser }) => {
  let o = await open(browser, s, TT.lastMinute, "/offer");
  await expect(o.page.getByRole("link", { name: "לקביעת הפגישה האישית בזום" })).toBeVisible();
  await o.ctx.close();
  o = await open(browser, s, TT.expired, "/offer");
  await expect(o.page.getByText("ההצעה הסתיימה.")).toBeVisible();
  const html = await o.page.content();
  for (const x of ["271 ₪", "139 ₪", "session271"]) expect(html).not.toContain(x);
  await expect(o.page.getByRole("heading", { level: 2, name: "יסודות היוגה" })).toBeVisible();
  await shot(o.page, "offer-expired");
  await axe(o.page);
  await o.ctx.close();
});

test("a client cannot move the clock: the real server clock decides (no test header, no test key)", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: s.storageState, extraHTTPHeaders: { "x-tsaad-test-now": TT.open } });
  const page = await ctx.newPage();
  await page.goto("/offer");
  // without the run key the header is ignored; the env clock (2026-12-04) applies: not yet
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ההצעה תופיע כאן ביום 14");
  await ctx.close();
});

test("yesodot: valid with a date, CTA link with UTM; after the expiry no button", async ({ browser }) => {
  let o = await open(browser, s, TT.yesodotLastDay, "/yesodot");
  await expect(o.page.getByText("המחיר הזה תקף עד 20 בדצמבר.")).toBeVisible();
  const a = o.page.getByRole("link", { name: "להרשמה ליסודות היוגה" });
  const u = new URL((await a.getAttribute("href"))!);
  expect(u.pathname).toBe("/yesodot1265");
  expect(u.searchParams.get("utm_campaign")).toBe("yesodot1265");
  await shot(o.page, "yesodot-valid");
  await axe(o.page);
  await o.ctx.close();

  o = await open(browser, s, TT.yesodotExpired, "/yesodot");
  await expect(o.page.getByText("המחיר הזה כבר לא תקף.")).toBeVisible();
  await expect(o.page.getByRole("link", { name: "להרשמה ליסודות היוגה" })).toHaveCount(0);
  await expect(o.page.getByRole("button", { name: "להרשמה ליסודות היוגה" })).toHaveCount(0);
  await axe(o.page);
  await o.ctx.close();
});

test("Today tile follows the offer state and the landing CTA is a real link when configured", async ({ browser, page }) => {
  const o = await open(browser, s, TT.open, "/today");
  await expect(o.page.locator(".t-entry h2")).toHaveText("ההמשך אחרי 14 הימים");
  await expect(o.page.locator(".t-entry")).not.toContainText("271");
  await o.ctx.close();

  await page.goto("/tsaad");
  await expect(page.getByRole("link", { name: "אני בפנים, להרשמה לאתגר" }).first()).toHaveAttribute("href", "https://pay.example.test/challenge79");
  await axe(page);
});

test("legal pages show the configured contacts as links", async ({ page }) => {
  await page.goto("/legal/accessibility");
  await expect(page.getByRole("link", { name: "access@example.test" })).toHaveAttribute("href", "mailto:access@example.test");
  await page.goto("/legal/privacy");
  await expect(page.getByRole("link", { name: "privacy@example.test" }).first()).toBeVisible();
  await page.goto("/legal/terms");
  await expect(page.getByRole("link", { name: "050-123-4567" })).toHaveAttribute("href", "tel:0501234567");
  await axe(page);
});
