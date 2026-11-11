import { expect, test } from "@playwright/test";
import { axe, clock, createUser, open, overflowingElements, pool, type Session } from "./helpers";

/**
 * Owner decisions round (D1 to D3), browser checks:
 * - D1b: the "תזכורת בוואטסאפ" switch on /reminders. Server A runs GHL_REMINDER_MODE=off (no switch); server B runs dry (switch
 *   for a participant with a GHL contact, default on, saved per user, keyboard operable, axe, 195px).
 * - D3: login with the email (not the username), and the generic error, at 195px.
 * - D2: the closed landing state at 195px.
 */
const A = "http://localhost:3100";
const B = "http://localhost:3101";
const NOW = "2026-12-04T14:00:00+02:00";

let s: Session;
test.beforeAll(async ({ browser }) => {
  s = await createUser(browser, "wa");
  await pool.query(`update users set ghl_contact_id = $1 where id = $2`, [`e2e-${s.userId.slice(0, 8)}`, s.userId]);
});

const pref = async () =>
  (await pool.query(`select whatsapp_reminders from users where id = $1`, [s.userId])).rows[0].whatsapp_reminders as boolean;

test("WhatsApp switch: absent while GHL reminders are off (server A)", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, NOW, `${A}/reminders`);
  await expect(page.getByRole("switch", { name: "תזכורת בוואטסאפ" })).toHaveCount(0);
  await ctx.close();
});

test("WhatsApp switch: on by default, toggled by keyboard, saved per user, axe (server B, dry)", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, NOW, `${B}/reminders`);
  const sw = page.getByRole("switch", { name: "תזכורת בוואטסאפ" });
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await axe(page);
  await sw.focus();
  await page.keyboard.press("Space");
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await expect.poll(pref).toBe(false);
  await page.reload();
  await expect(page.getByRole("switch", { name: "תזכורת בוואטסאפ" })).toHaveAttribute("aria-checked", "false");
  await axe(page);
  await page.getByRole("switch", { name: "תזכורת בוואטסאפ" }).press("Enter");
  await expect.poll(pref).toBe(true);
  await ctx.close();
});

test("WhatsApp switch at 195px: no horizontal scroll", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, NOW, `${B}/reminders`, { width: 195 });
  await expect(page.getByRole("switch", { name: "תזכורת בוואטסאפ" })).toBeVisible();
  expect(await overflowingElements(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await ctx.close();
});

test("login with the email at 195px; a wrong password gives the generic error; axe", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: A, viewport: { width: 195, height: 800 }, locale: "he-IL", extraHTTPHeaders: clock(NOW) });
  const page = await ctx.newPage();
  await page.goto("/login");
  const id = page.getByLabel("שם משתמש, טלפון או מייל");
  await id.fill(`${s.username.toUpperCase()}@EXAMPLE.TEST`);
  await page.getByLabel("סיסמה", { exact: true }).fill("not-the-pass-1");
  await page.keyboard.press("Enter");
  await expect(page.locator("#login-form-err")).toHaveText("הפרטים או הסיסמה לא נכונים");
  await expect(id).toBeFocused();
  expect(await overflowingElements(page)).toEqual([]);
  await axe(page);
  await page.getByLabel("סיסמה", { exact: true }).fill("today-pass-12");
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await page.waitForURL("**/today");
  await ctx.close();
});

test("closed landing at 195px (server B, with the next-cohort link): no horizontal scroll, axe", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: B, viewport: { width: 195, height: 800 }, locale: "he-IL", extraHTTPHeaders: clock("2026-12-03T05:00:00+02:00") });
  const page = await ctx.newPage();
  await page.goto("/tsaad");
  await expect(page.getByText("ההרשמה למחזור הזה נסגרה").first()).toBeVisible();
  expect(await overflowingElements(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await axe(page);
  await ctx.close();
});
