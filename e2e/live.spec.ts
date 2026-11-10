import { expect, test, type Page } from "@playwright/test";
import { LIVE_URL, T, axe, clock, createUser, expectReflowAndTargets, open, pool, shot, type Session } from "./helpers";

/**
 * /live: מצבי המפגשים לפי שעון השרת (שעון הבדיקות). בסביבת ה־e2e יום 7 מוגדר במלואו (20:00 וקישור) ויום 14 לא מוגדר.
 * חלון הקישור: מ־19:00 (שעה לפני) עד 22:30 (150 דקות אחרי ההתחלה). מחוץ לחלון הקישור לא נמצא ב־HTML, ב־JS ובתגובות.
 */
let s: Session;
test.beforeAll(async ({ browser }) => {
  s = await createUser(browser, "live");
});
test.beforeEach(async () => {
  await pool.query("delete from action_completions where user_id = $1", [s.userId]);
});

const joinLink = (p: Page) => p.getByRole("link", { name: "הצטרפות למפגש של יום 7" });
const joinDisabled = (p: Page) => p.locator("button.lv-join[aria-disabled='true']");

/** אוסף את כל גופי התגובות (טקסט) שהדף קיבל, כדי להוכיח שהקישור לא נשלח לפני החלון. */
function collectBodies(page: Page) {
  const bodies: string[] = [];
  page.on("response", async (r) => {
    try {
      const ct = r.headers()["content-type"] ?? "";
      if (/text|json|javascript/.test(ct)) bodies.push(await r.text());
    } catch {
      /* גוף שלא זמין (redirect) */
    }
  });
  return bodies;
}

test.describe("live: before the window", () => {
  test("day 7 configured: time shown, join disabled with the reason, calendar enabled, URL nowhere", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, T.day7Morning, "/live");
    const bodies = collectBodies(page);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("חצי הדרך, יחד עם אביטל");
    await expect(page.locator(".lv-when time")).toContainText("20:00");
    await expect(page.locator(".lv-when time")).toHaveAttribute("datetime", "2026-12-07T18:00:00.000Z");

    const dis = joinDisabled(page);
    await expect(dis).toHaveText("הקישור ייפתח כאן שעה לפני המפגש.");
    await expect(dis).toHaveAttribute("aria-describedby", "live-reg");
    await expect(page.locator("#live-reg")).toHaveText("הקישור מופיע רק למי שנרשמו לאתגר.");
    await dis.focus(); // aria-disabled stays focusable, so its text can be read
    await expect(dis).toBeFocused();
    await dis.click({ force: true });
    await expect(page).toHaveURL(/\/live$/);

    const cal = page.getByRole("link", { name: "הוספה ליומן: המפגש ביום 7" });
    await expect(cal).toHaveAttribute("href", "/api/live/7/ics");
    await expect(cal).toHaveAttribute("download", "");

    expect(await page.content()).not.toContain("live.example.test");
    expect(bodies.join("\n")).not.toContain("live.example.test");
    await expectReflowAndTargets(page);
    await axe(page);
    await shot(page, "live-before");
    await ctx.close();
  });

  test("day 14 unset: time to be announced, no calendar (disabled with a note), join disabled", async ({ browser }) => {
    // focus is day 7 here; look at the compact day 14 tile
    const { ctx, page } = await open(browser, s, T.day7Morning, "/live");
    const tile = page.locator(".t-live-other");
    await expect(tile.getByRole("heading", { level: 2 })).toHaveText("מפגש הסיום");
    // Neutral copy instead of the raw placeholder (the placeholder stays in config/docs only).
    await expect(tile.locator(".lv-tba")).toHaveText("השעה תפורסם בקרוב.");
    expect(await page.content()).not.toContain("[LIVE_DAY");
    const cal = tile.getByRole("button", { name: "הוספה ליומן: המפגש ביום 14" });
    await expect(cal).toHaveAttribute("aria-disabled", "true");
    await expect(tile).toContainText("אפשר יהיה להוסיף ליומן כשהתאריך והשעה יתפרסמו.");
    await expect(page.getByText("אי אפשר להגיע?")).toBeVisible();
    await axe(page);
    await ctx.close();
  });

  test("one minute before the window the link is still absent from HTML and responses", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, T.day7BeforeWindow, "/live");
    const bodies = collectBodies(page);
    await page.reload();
    await expect(joinDisabled(page)).toBeVisible();
    await expect(joinLink(page)).toHaveCount(0);
    expect(await page.content()).not.toContain(LIVE_URL);
    expect(bodies.join("\n")).not.toContain(LIVE_URL);
    await ctx.close();
  });

  test("before the challenge starts nothing opens either", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, "2026-11-30T12:00:00+02:00", "/live");
    await expect(joinDisabled(page)).toBeVisible();
    expect(await page.content()).not.toContain(LIVE_URL);
    await ctx.close();
  });
});

test.describe("live: window open", () => {
  test("the join link appears at exactly one hour before, opens in a new tab safely, and is announced politely", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, T.day7WindowOpens, "/live");
    const link = joinLink(page);
    await expect(link).toHaveAttribute("href", LIVE_URL);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toContainText("הצטרפות למפגש");
    await expect(page.locator("[role=status]", { hasText: "הקישור למפגש פתוח" })).toHaveCount(1);
    await expect(joinDisabled(page)).toHaveCount(0);
    await expectReflowAndTargets(page);
    await axe(page);
    await shot(page, "live-open");
    await ctx.close();
  });

  test("the join link survives into the session and disappears after the grace period", async ({ browser }) => {
    const during = await open(browser, s, T.day7InSession, "/live");
    await expect(joinLink(during.page)).toBeVisible();
    await during.ctx.close();
    const after = await open(browser, s, T.day7Passed, "/live");
    await expect(joinLink(after.page)).toHaveCount(0);
    expect(await after.page.content()).not.toContain(LIVE_URL);
    await after.ctx.close();
  });
});

test.describe("live: passed", () => {
  test("after the session day 7 says it ended and day 14 takes the stage (unset time: neutral to-be-announced line)", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, T.day8Noon, "/live");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("מפגש הסיום");
    await expect(page.locator(".lv-when .lv-tba")).toHaveText("השעה תפורסם בקרוב.");
    expect(await page.content()).not.toContain("[LIVE_DAY");
    await expect(page.locator(".t-live-other")).toContainText("המפגש הסתיים.");
    await expect(page.getByRole("link", { name: /הצטרפות למפגש/ })).toHaveCount(0);
    await axe(page);
    await shot(page, "live-passed-day7");
    await ctx.close();
  });

  test("after day 14 both sessions ended", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, T.afterEnd, "/live");
    await expect(page.locator(".lv-join--off")).toHaveText("המפגש הסתיים.");
    await expect(page.locator(".t-live-other")).toContainText("המפגש הסתיים.");
    await axe(page);
    await ctx.close();
  });
});

test.describe("live: attendance (optional mark, server rules)", () => {
  const attendBtn = (p: Page) => p.getByRole("button", { name: "סימון: הייתי במפגש" });
  const liveRows = async () =>
    (await pool.query("select day from action_completions where user_id = $1 and action = 'live' order by day", [s.userId])).rows.map((r) => r.day as number);

  test("not offered before the session starts", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, T.day7Morning, "/live");
    await expect(attendBtn(page)).toHaveCount(0);
    await ctx.close();
  });

  test("marks and unmarks through the same rules as Today; live counts as 2 steps in the cup", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, T.day7InSession, "/live");
    const btn = attendBtn(page);
    await expect(btn).toHaveAttribute("aria-pressed", "false");
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".lv-attend-msg")).toHaveText("נשמר. הכוס עלתה.");
    expect(await liveRows()).toEqual([7]);
    await shot(page, "live-attended");
    await axe(page);

    await page.goto("/today");
    await expect(page.getByRole("img", { name: "הכוס של היום, שלושה רבעים" })).toBeVisible();

    await page.goto("/live");
    await attendBtn(page).click();
    await expect(attendBtn(page)).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".lv-attend-msg")).toHaveText("הסימון בוטל.");
    expect(await liveRows()).toEqual([]);
    await ctx.close();
  });

  test("the day after, day 7 can still be marked until midnight (yesterday), from its compact tile", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, T.day8Noon, "/live");
    const btn = page.locator(".t-live-other").getByRole("button", { name: "סימון: הייתי במפגש" });
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(await liveRows()).toEqual([7]);
    await axe(page);
    await ctx.close();
  });

  test("once the window is closed there is no toggle, and a mark that exists is shown as text", async ({ browser }) => {
    await pool.query("insert into action_completions (user_id, day, action) values ($1, 7, 'live')", [s.userId]);
    const { ctx, page } = await open(browser, s, T.day9Noon, "/live");
    await expect(page.getByRole("button", { name: "סימון: הייתי במפגש" })).toHaveCount(0);
    await expect(page.locator(".lv-attend-done")).toHaveText("סומן: הייתי במפגש");
    await ctx.close();
  });

  test("the server refuses a mark on a closed day and the screen says so honestly", async ({ browser }) => {
    // open at day 8 (day 7 markable), then move the server clock to day 9 and click
    const { ctx, page } = await open(browser, s, T.day8Noon, "/live");
    await ctx.setExtraHTTPHeaders(clock(T.day9Noon));
    const btn = page.locator(".t-live-other").getByRole("button", { name: "סימון: הייתי במפגש" });
    await btn.click();
    await expect(page.locator(".lv-attend-msg")).toHaveText("הסימון לא נשמר. אפשר לנסות שוב.");
    expect(await liveRows()).toEqual([]);
    await ctx.close();
  });
});

test.describe("live: calendar file (.ics)", () => {
  test("day 7 downloads a UTC event from 20:00 Jerusalem time, with no join link inside", async ({ browser }) => {
    const { ctx } = await open(browser, s, T.day7Morning, "/live");
    const res = await ctx.request.get("/api/live/7/ics", { headers: clock(T.day7Morning) });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    expect(res.headers()["content-disposition"]).toContain('attachment; filename="tsaad-live-day7.ics"');
    expect(res.headers()["cache-control"]).toContain("no-store");
    const body = (await res.text()).replace(/\r\n /g, "");
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("DTSTART:20261207T180000Z");
    expect(body).toContain("SUMMARY:צעד קטן ביום: חצי הדרך\\, יחד עם אביטל");
    expect(body).not.toContain("live.example.test");
    await ctx.close();
  });

  test("day 14 (no time) and other days are 404, and without a session it is 401", async ({ browser, request }) => {
    const { ctx } = await open(browser, s, T.day7Morning, "/live");
    expect((await ctx.request.get("/api/live/14/ics", { headers: clock(T.day7Morning) })).status()).toBe(404);
    expect((await ctx.request.get("/api/live/5/ics", { headers: clock(T.day7Morning) })).status()).toBe(404);
    expect((await ctx.request.get("/api/live/abc/ics", { headers: clock(T.day7Morning) })).status()).toBe(404);
    await ctx.close();
    expect((await request.get("/api/live/7/ics")).status()).toBe(401);
  });
});

test("320px: no horizontal scroll and the same content", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, T.day7WindowOpens, "/live", { width: 320 });
  await expectReflowAndTargets(page);
  await axe(page);
  await shot(page, "live-open-320");
  await ctx.close();
});

test("reduced motion: the pulse dot does not animate", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, T.day7Morning, "/live", { reducedMotion: true });
  expect(await page.locator(".lv-dot").evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
  await ctx.close();
});

test("the bottom nav leads to the live and reminders screens (no longer 404)", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, T.day4Noon, "/today");
  await page.getByRole("navigation", { name: "ניווט ראשי" }).getByRole("link", { name: "לייב" }).click();
  await expect(page).toHaveURL(/\/live$/);
  await expect(page.getByRole("navigation", { name: "ניווט ראשי" }).getByRole("link", { name: "לייב" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("navigation", { name: "ניווט ראשי" }).getByRole("link", { name: "תזכורות" }).click();
  await expect(page).toHaveURL(/\/reminders$/);
  await ctx.close();
});
