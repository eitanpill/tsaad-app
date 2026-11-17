import { expect, test, type Page } from "@playwright/test";
import { T, axe, clock, createUser, expectReflowAndTargets, open, type Session } from "./helpers";

/**
 * Opening live ("day 0"), server B: START_DATE 2026-12-01, so day 0 is 2026-11-30; LIVE_TIME_DAY0=19:00 and a LIVE_URL_DAY0.
 * The join link window is 18:00 to 21:00 (60 minutes before to 120 after the start). Day 0 adds nothing to the cup.
 */
test.use({ baseURL: "http://localhost:3101" });

const URL0 = "https://live.example.test/e2e-room-day0";
const D0 = {
  early: "2026-11-25T12:00:00+02:00",
  morning: "2026-11-30T09:00:00+02:00",
  beforeWindow: "2026-11-30T17:59:00+02:00",
  windowOpens: "2026-11-30T18:00:00+02:00",
  inSession: "2026-11-30T19:30:00+02:00",
  closed: "2026-11-30T21:01:00+02:00",
};

let s: Session;
test.beforeAll(async ({ browser }) => {
  s = await createUser(browser, "open0");
});

const card = (p: Page) => p.getByTestId("opening-live");
const joinLink = (p: Page) => p.getByRole("link", { name: "הצטרפות למפגש הפתיחה" });

test.describe("before-start screen: the opening live card", () => {
  test("days before: date and time shown, join disabled with the reason, calendar file available, URL nowhere", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, D0.early, "/today");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("האתגר מתחיל ב");
    await expect(card(page)).not.toHaveClass(/t-live-open--today/);
    await expect(card(page).getByRole("heading", { level: 2 })).toHaveText("מפגש הפתיחה, יחד עם אביטל");
    await expect(card(page).locator("time")).toContainText("19:00");
    await expect(card(page).locator("time")).toHaveAttribute("datetime", "2026-11-30T17:00:00.000Z");
    await expect(card(page).locator("time")).toContainText("30"); // the date (30 November)
    await expect(card(page).locator("button.lv-join[aria-disabled='true']")).toHaveText("הקישור ייפתח כאן שעה לפני המפגש.");
    await expect(card(page).getByRole("link", { name: "הוספה ליומן: מפגש הפתיחה" })).toHaveAttribute("href", "/api/live/0/ics");
    await expect(card(page)).toContainText("לא נספר בכוס ולא נכלל ב־12 הימים");
    expect(await page.content()).not.toContain("e2e-room-day0");
    expect(await page.content()).not.toContain("[LIVE_DAY");
    await expectReflowAndTargets(page);
    await axe(page);
    await ctx.close();
  });

  test("on day 0 itself the card is prominent: right after the hero, before the countdown tile", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, D0.morning, "/today");
    await expect(card(page)).toHaveClass(/t-live-open--today/);
    await expect(card(page)).toContainText("היום: מפגש הפתיחה");
    const order = await page.evaluate(() => {
      const idx = (sel: string) => Array.from(document.querySelectorAll(".today--before > section")).findIndex((e) => e.matches(sel));
      return { hero: idx(".t-hero"), live: idx("[data-testid=opening-live]"), count: idx(".t-count") };
    });
    expect(order.hero).toBe(0);
    expect(order.live).toBe(1);
    expect(order.count).toBe(2);
    await axe(page);
    await ctx.close();
  });

  test("window: absent from HTML at 17:59, a safe link at 18:00, still there at 19:30, gone and ended after 21:00", async ({ browser }) => {
    const before = await open(browser, s, D0.beforeWindow, "/today");
    await expect(card(before.page).locator("button.lv-join[aria-disabled='true']")).toBeVisible();
    expect(await before.page.content()).not.toContain("e2e-room-day0");
    await before.ctx.close();

    const opens = await open(browser, s, D0.windowOpens, "/today");
    const link = joinLink(opens.page);
    await expect(link).toHaveAttribute("href", URL0);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(card(opens.page).locator("button.lv-join")).toHaveCount(0);
    await axe(opens.page);
    await opens.ctx.close();

    const during = await open(browser, s, D0.inSession, "/today");
    await expect(joinLink(during.page)).toBeVisible();
    await during.ctx.close();

    const after = await open(browser, s, D0.closed, "/today");
    await expect(joinLink(after.page)).toHaveCount(0);
    await expect(card(after.page).locator(".lv-join--off")).toHaveText("המפגש הסתיים.");
    expect(await after.page.content()).not.toContain("e2e-room-day0");
    await axe(after.page);
    await after.ctx.close();
  });

  test("once day 1 opens the before-start screen and its card are gone", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, "2026-12-01T05:00:00+02:00", "/today");
    await expect(card(page)).toHaveCount(0);
    await expect(page.locator(".chip")).toHaveText("יום 1 מתוך 14");
    await ctx.close();
  });
});

test.describe("/live lists the three sessions", () => {
  test("opening, day 7, day 14 in order; day 0 is the focus before the challenge; no attendance mark for it", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, D0.inSession, "/live");
    const items = page.locator(".lv-all li");
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText("מפגש פתיחה");
    await expect(items.nth(0)).toHaveAttribute("aria-current", "step");
    await expect(items.nth(0).locator("time")).toContainText("19:00");
    await expect(items.nth(0).locator(".lv-all-state")).toHaveText("הקישור פתוח עכשיו");
    await expect(items.nth(1)).toContainText("חצי הדרך, יחד עם אביטל");
    await expect(items.nth(1).locator("time")).toContainText("20:00");
    await expect(items.nth(1).locator(".lv-all-state")).toHaveText("בקרוב");
    await expect(items.nth(2).locator("time")).toContainText("20:00");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("מפגש הפתיחה, יחד עם אביטל");
    await expect(joinLink(page)).toHaveAttribute("href", URL0);
    await expect(page.getByRole("button", { name: "סימון: הייתי במפגש" })).toHaveCount(0);
    await expectReflowAndTargets(page);
    await axe(page);
    await ctx.close();
  });

  test("after day 0 passes, day 7 takes the focus and day 0 reads as ended", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, T.day4Noon, "/live");
    await expect(page.locator('.lv-all li[data-day="0"] .lv-all-state')).toHaveText("הסתיים");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("חצי הדרך, יחד עם אביטל");
    await expect(page.getByRole("button", { name: "סימון: הייתי במפגש" })).toHaveCount(0); // day 7 not started, and day 0 never has one
    await ctx.close();
  });
});

test.describe("calendar file", () => {
  test("day 0 downloads an event on 2026-11-30 at 19:00 Jerusalem time, without the join link", async ({ browser }) => {
    const { ctx } = await open(browser, s, D0.early, "/today");
    const res = await ctx.request.get("/api/live/0/ics", { headers: clock(D0.early) });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-disposition"]).toContain('filename="tsaad-live-day0.ics"');
    const body = (await res.text()).replace(/\r\n /g, "");
    expect(body).toContain("DTSTART:20261130T170000Z");
    expect(body).toContain("SUMMARY:צעד קטן ביום: מפגש הפתיחה\\, יחד עם אביטל");
    expect(body).not.toContain("live.example.test");
    await ctx.close();
  });
});
