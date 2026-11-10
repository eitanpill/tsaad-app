import AxeBuilder from "@axe-core/playwright";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { Pool } from "pg";

/** עזרים משותפים לבדיקות של שלב 9 (live, reminders, install, pwa): משתמש, שעון בדיקות, axe, צילומי מסך. */
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const SHOTS = process.env.SHOTS_DIR;
export const KEY = process.env.TSAAD_TEST_CLOCK_KEY!;
export const clock = (now: string) => ({ "x-tsaad-test-now": now, "x-tsaad-test-key": KEY });
const sha = (v: string) => createHash("sha256").update(v).digest("hex");

export const LIVE_URL = "https://live.example.test/e2e-room-day7";

// START_DATE=2026-12-01 (Israel winter, +02:00): day N opens at 05:00 on 2026-12-N.
export const T = {
  day4Noon: "2026-12-04T14:00:00+02:00",
  day7Morning: "2026-12-07T10:00:00+02:00",
  day7BeforeWindow: "2026-12-07T18:59:00+02:00",
  day7WindowOpens: "2026-12-07T19:00:00+02:00",
  day7InSession: "2026-12-07T20:30:00+02:00",
  day7Passed: "2026-12-07T22:01:00+02:00",
  day8Noon: "2026-12-08T12:00:00+02:00",
  day9Noon: "2026-12-09T12:00:00+02:00",
  day14Noon: "2026-12-14T12:00:00+02:00",
  afterEnd: "2026-12-16T10:00:00+02:00",
};

export async function createUser(browser: Browser, prefix: string) {
  const username = `${prefix}-${randomBytes(3).toString("hex")}`;
  const r = await pool.query(
    `insert into users (username, display_name, email, phone) values ($1, 'בדיקה', $2, '050-111-2222') returning id`,
    [username, `${username}@example.test`],
  );
  const userId = r.rows[0].id as string;
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `insert into activation_tokens (user_id, token_hash, purpose, expires_at) values ($1, $2, 'activate', now() + interval '30 minutes')`,
    [userId, sha(token)],
  );
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/activate?token=${token}`);
  await page.getByLabel("בחירת סיסמה", { exact: true }).fill("today-pass-12");
  await page.getByLabel("אימות הסיסמה", { exact: true }).fill("today-pass-12");
  await page.getByRole("button", { name: "שמירה וכניסה" }).click();
  await page.waitForURL("**/today");
  const storageState = await ctx.storageState();
  await ctx.close();
  return { userId, username, storageState };
}

export type Session = Awaited<ReturnType<typeof createUser>>;

export async function open(
  browser: Browser,
  s: Session,
  now: string,
  url: string,
  opts: {
    width?: number;
    reducedMotion?: boolean;
    init?: string | ((arg: unknown) => void);
    initArg?: unknown;
  } = {},
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({
    storageState: s.storageState,
    extraHTTPHeaders: clock(now),
    viewport: { width: opts.width ?? 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: opts.reducedMotion ? "reduce" : "no-preference",
    locale: "he-IL",
  });
  if (opts.init) await ctx.addInitScript(opts.init as never, opts.initArg);
  const page = await ctx.newPage();
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return { ctx, page };
}

export async function axe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`)).toEqual([]);
}

export async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}-390.png` });
}

/** אין גלילה אופקית, וכל פקד אינטראקטיבי נראה לעין הוא לפחות 44x44. */
export async function expectReflowAndTargets(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const small = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("main button, main a, nav a, header a, header button")) {
      if (el.closest(".visually-hidden") || el.classList.contains("skip-link")) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // inline text links inside a sentence are exempt (WCAG 2.5.8 inline exception); our links are blocks with min-height.
      if (r.height < 43.5 || r.width < 43.5) out.push(`${el.tagName} "${el.textContent?.trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  expect(small).toEqual([]);
}
