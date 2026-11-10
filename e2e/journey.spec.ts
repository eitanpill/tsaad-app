import { readFileSync } from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { clock, createUser, pool, type Session } from "./helpers";

/**
 * שלב 11: מסע מלא של 14 ימים עם שעון הבדיקות (START_DATE=2026-12-01, יום N נפתח ב־05:00 ב־2026-12-N, +02:00).
 * מסמנים כל יום חוץ מ־3 ו־9 (12 מתוך 14 = הושלם); יום 5 מסומן רק למחרת ב־23:59 ("אתמול עד חצות");
 * ימי הלייב (7, 14) מסומנים בהרגל ובלייב (2 צעדים); בין 00:00 ל־05:00 רק היום הנוכחי פתוח.
 * גם: תוכן כל יום (src/content/days.ts) מופיע במסך היום ובדף היום, ותזכורת יומית רצה ב־dry-run דרך ה־cron.
 */

const DAYS_SRC = readFileSync("src/content/days.ts", "utf8");
/** the habit title of each day, read from the content file the app renders */
const HABITS: string[] = [...DAYS_SRC.matchAll(/habit: \{ type: "habit", title: "([^"]+)"/g)].map((m) => m[1]);
const CRON = process.env.CRON_SECRET!;

const at = (day: number, hhmm: string) => `2026-12-${String(day).padStart(2, "0")}T${hhmm}:00+02:00`;

let s: Session;
test.beforeAll(async ({ browser }) => {
  expect(HABITS).toHaveLength(14);
  s = await createUser(browser, "journey");
});

async function openAt(browser: Browser, now: string, url: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const ctx = await browser.newContext({ storageState: s.storageState, extraHTTPHeaders: clock(now), locale: "he-IL", serviceWorkers: "block" });
  const page = await ctx.newPage();
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return { page, close: () => ctx.close() };
}

async function mark(page: Page, key: string) {
  const b = page.locator(`[data-action-key="${key}"]`);
  await b.click();
  await expect(b).toHaveAttribute("aria-pressed", "true");
  // the save reached the server
  await expect(page.locator(".toast-region")).not.toContainText("לא נשמר");
}

const rows = async () =>
  (await pool.query("select day, action from action_completions where user_id = $1 order by day, action", [s.userId])).rows as Array<{ day: number; action: string }>;

test("14 days with the test clock: boundaries, yesterday until midnight, night hours, live days, 12/14, end", async ({ browser }) => {
  test.setTimeout(180_000);

  // before the start: nothing is open, day 1 is locked
  {
    const { page, close } = await openAt(browser, at(1, "04:59"), "/today");
    await expect(page.locator("[data-action-key]")).toHaveCount(0);
    expect((await page.goto("/day/1"))?.status()).toBe(200);
    await expect(page.locator("[data-action-key]")).toHaveCount(0);
    await close();
  }

  for (let day = 1; day <= 14; day++) {
    const { page, close } = await openAt(browser, at(day, "05:00"), "/today");
    // the day's content: its habit is on the habit button, and the chip names the day
    await expect(page.locator(`[data-action-key="${day}:habit"]`)).toContainText(HABITS[day - 1]);
    await expect(page.getByText(`יום ${day} מתוך 14`)).toBeVisible();
    // tomorrow is locked at 05:00 today
    if (day < 14) {
      const r = await page.request.get(`/api/video/${day + 1}`, { headers: clock(at(day, "05:00")) });
      expect(r.status()).toBe(403);
    }
    if (day === 7 || day === 14) {
      await mark(page, `${day}:habit`);
      await mark(page, `${day}:live`);
    } else if (day !== 3 && day !== 5 && day !== 9) {
      await mark(page, `${day}:habit`);
    }
    await close();

    if (day === 4) {
      // 00:30 on 2026-12-05 is still day 4: only day 4 is open, day 3 (two days back) is closed
      const night = await openAt(browser, at(5, "00:30"), "/day/3");
      await expect(night.page.locator("[data-action-key]")).toHaveCount(0);
      await night.page.goto("/today");
      await expect(night.page.getByText("יום 4 מתוך 14")).toBeVisible();
      await night.close();
    }
    if (day === 6) {
      // day 5 forgotten: still markable as yesterday at 23:59 on day 6
      const late = await openAt(browser, at(6, "23:59"), "/day/5");
      await mark(late.page, "5:habit");
      await late.close();
    }
    if (day === 10) {
      // 00:30 on 2026-12-11 is still day 10, and yesterday (day 9) closed at midnight
      const night = await openAt(browser, at(11, "00:30"), "/day/9");
      await expect(night.page.locator("[data-action-key]")).toHaveCount(0);
      await night.close();
      // the server refuses too (not only the UI)
      expect((await rows()).some((r) => r.day === 9)).toBe(false);
    }
  }

  // 12 of 14 counted, the challenge is complete on day 14
  const counted = new Set((await rows()).map((r) => r.day));
  expect([...counted].sort((a, b) => a - b)).toEqual([1, 2, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14]);
  {
    const { page, close } = await openAt(browser, at(14, "21:00"), "/today");
    await expect(page.getByText("האתגר הושלם")).toBeVisible();
    await expect(page.getByRole("img", { name: /12 מתוך 14/ })).toBeVisible();
    await close();
  }
  // after the end (day 15 05:00): ended, nothing markable; yesterday (14) stays markable until midnight is over
  {
    const { page, close } = await openAt(browser, at(16, "10:00"), "/today");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("האתגר הסתיים");
    await expect(page.locator("[data-action-key]")).toHaveCount(0);
    await page.goto("/path");
    await expect(page.getByRole("main").getByText("12 מתוך 14", { exact: true })).toBeVisible();
    await close();
  }
});

test("the reminders cron runs in dry-run once per user per day (not before 07:30, never sends); cleanup and sync answer", async ({ request }) => {
  const auth = { authorization: `Bearer ${CRON}` };
  // reminders go only to users with a push subscription (fake endpoint: in dry-run nothing is sent)
  await pool.query(
    "insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, 'BQ', 'AQ') on conflict do nothing",
    [s.userId, `https://fcm.googleapis.com/fcm/send/journey-${s.userId}`],
  );
  expect((await request.get("/api/cron/reminders")).status()).toBe(401);
  expect((await request.get("/api/cron/reminders", { headers: { authorization: "Bearer wrong-secret-value" } })).status()).toBe(401);

  // before 07:30: nothing
  const early = await request.get("/api/cron/reminders", { headers: { ...auth, ...clock(at(3, "07:00")) } });
  expect(early.status()).toBe(200);
  expect(await early.json()).toMatchObject({ skipped: "too_early", day: 3 });
  const before = (await pool.query("select count(*)::int n from reminder_log where user_id = $1 and date = '2026-12-03'", [s.userId])).rows[0].n;
  expect(before).toBe(0);

  const first = await request.get("/api/cron/reminders", { headers: { ...auth, ...clock(at(3, "07:31")) } });
  expect(first.status()).toBe(200);
  expect(await first.json()).toMatchObject({ mode: "dry", sent: 0 });
  const second = await request.get("/api/cron/reminders", { headers: { ...auth, ...clock(at(3, "07:46")) } });
  expect(second.status()).toBe(200);
  const log = (await pool.query("select status from reminder_log where user_id = $1 and date = '2026-12-03'", [s.userId])).rows;
  expect(log).toEqual([{ status: "dry_run" }]);

  const clean = await request.get("/api/cron/cleanup", { headers: auth });
  expect(clean.status()).toBe(200);
  const sync = await request.get("/api/cron/sync", { headers: auth });
  expect(await sync.json()).toMatchObject({ enabled: false });
});

test("the 14-day content: today's opening line and the past day page show that day's three titles", async ({ browser }) => {
  const titles = (day: number) => {
    const block = DAYS_SRC.split(/\n  \{\n    day: /)[day];
    return [...block.matchAll(/title: "([^"]+)"/g)].map((m) => m[1]);
  };
  for (const day of [2, 13]) {
    const { page, close } = await openAt(browser, at(day, "08:00"), "/today");
    for (const t of titles(day)) await expect(page.getByRole("main")).toContainText(t);
    await expect(page.getByRole("main").locator(".opening")).toContainText(`יום ${day}.`);
    await page.goto(`/day/${day - 1}`);
    for (const t of titles(day - 1)) await expect(page.getByRole("main")).toContainText(t);
    await close();
  }
});
