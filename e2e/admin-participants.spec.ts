import { expect, test, type Browser } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { axe, clock, createUser, pool, T, type Session } from "./helpers";

/**
 * /admin/participants and the owner-only day preview, on server B (ADMIN_USERNAMES=e2eadmin, START_DATE 2026-12-01, test clock day 4).
 * Nothing is ever sent: the activation link is shown on screen once, for the owner to send by hand.
 */
test.use({ baseURL: "http://localhost:3101" });
test.describe.configure({ mode: "serial" });

let admin: Session;

async function adminCtx(browser: Browser) {
  const ctx = await browser.newContext({
    storageState: admin.storageState,
    extraHTTPHeaders: clock(T.day4Noon),
    viewport: { width: 390, height: 900 },
    locale: "he-IL",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  return { ctx, page: await ctx.newPage() };
}

async function activate(browser: Browser, link: string, password: string) {
  const ctx = await browser.newContext({ locale: "he-IL" });
  const page = await ctx.newPage();
  await page.goto(link);
  await page.getByLabel("בחירת סיסמה", { exact: true }).fill(password);
  await page.getByLabel("אימות הסיסמה", { exact: true }).fill(password);
  await page.getByRole("button", { name: "שמירה וכניסה" }).click();
  await page.waitForURL("**/today");
  return { ctx, page };
}

test.beforeAll(async ({ browser }) => {
  // a previous spec may have left a user named e2eadmin (admin.spec renames its user): free the name first
  await pool.query("update users set username = 'old-' || substr(id::text, 1, 8) where username = 'e2eadmin'");
  admin = await createUser(browser, "padmin");
  await pool.query("update users set username = 'e2eadmin' where id = $1", [admin.userId]);
});

test.afterAll(async () => {
  await pool.query("update users set username = 'done-' || substr(id::text, 1, 8) where id = $1", [admin.userId]);
});

test("logged out and non-admin users get the normal 404 on /admin/participants", async ({ browser, request }) => {
  expect((await request.get("/admin/participants")).status()).toBe(404);
  const s = await createUser(browser, "notadm");
  const ctx = await browser.newContext({ storageState: s.storageState });
  const res = await ctx.request.get("/admin/participants");
  expect(res.status()).toBe(404);
  expect((await res.text()).includes("הוספת משתתפת")).toBe(false);
  await ctx.close();
});

test("admin adds a participant by hand: link shown once with a copy button, and it really activates the account", async ({ browser }) => {
  const { ctx, page } = await adminCtx(browser);
  await page.goto("/admin/participants");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("משתתפים");
  // the two owner pages link to each other
  await page.getByRole("navigation", { name: "דפי הבעלים" }).getByRole("link", { name: "סטטיסטיקה" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("סטטיסטיקה");
  await page.getByRole("navigation", { name: "דפי הבעלים" }).getByRole("link", { name: "משתתפים" }).click();

  const phone = `052${Math.floor(1000000 + Math.random() * 8999999)}`;
  await page.getByLabel("שם", { exact: true }).fill("דנה כהן");
  await page.getByLabel(/^טלפון/).first().fill(phone);
  await page.getByRole("button", { name: "יצירה וקבלת קישור" }).click();

  const panel = page.getByTestId("one-time-link");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("הקישור מוצג פעם אחת. שלחו אותו בעצמכם בוואטסאפ או במייל.")).toBeVisible();
  const link = await panel.getByRole("textbox").inputValue();
  expect(link).toMatch(/^http:\/\/localhost:3101\/activate\?token=[\w-]{20,}$/);
  await panel.getByRole("button", { name: "העתקת הקישור" }).click();
  await expect(panel.getByText("הקישור הועתק")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  await axe(page);

  // only the hash is stored
  const token = new URL(link).searchParams.get("token")!;
  expect((await pool.query("select count(*)::int n from activation_tokens where token_hash = $1", [token])).rows[0].n).toBe(0);

  // reload: the link is gone, the participant is in the list (not activated yet, not disabled)
  await page.reload();
  await expect(page.getByTestId("one-time-link")).toHaveCount(0);
  const row = page.locator("li.adm-item", { hasText: "דנה כהן" }).first();
  await expect(row).toBeVisible();
  await expect(row.locator("dd").nth(4)).toHaveText("לא");

  // the link works with the real /activate path
  const user = await activate(browser, link, "manual-pass-12");
  await user.ctx.close();
  await page.reload();
  await expect(page.locator("li.adm-item", { hasText: "דנה כהן" }).first().locator("dd").nth(4)).toHaveText("כן");
  await ctx.close();
});

test("invalid input is refused; search narrows the list", async ({ browser }) => {
  const { ctx, page } = await adminCtx(browser);
  await page.goto("/admin/participants");
  await page.getByLabel("שם", { exact: true }).fill("בדיקה");
  await page.getByLabel(/^טלפון/).first().fill("12");
  await page.getByRole("button", { name: "יצירה וקבלת קישור" }).click();
  await expect(page.locator(".adm-msg--err")).toContainText("הכניסו טלפון תקין או אימייל תקין");
  await page.getByLabel("חיפוש לפי שם, שם משתמש, אימייל או טלפון").fill("דנה כהן");
  await page.getByRole("button", { name: "חיפוש" }).click();
  await expect(page).toHaveURL(/q=/);
  await expect(page.locator("li.adm-item").first()).toContainText("דנה כהן");
  await ctx.close();
});

test("new link, disable (login refused, signed out at once), enable, and delete behind a typed confirmation", async ({ browser }) => {
  const target = await createUser(browser, "victim");
  const { ctx, page } = await adminCtx(browser);
  await page.goto(`/admin/participants?q=${target.username}`);
  const row = page.locator("li.adm-item", { hasText: target.username });
  await expect(row).toHaveCount(1);

  // an activated user gets a password-reset link
  await row.getByRole("button", { name: /קישור איפוס סיסמה/ }).click();
  const reset = row.getByTestId("one-time-link");
  await expect(reset).toContainText("קישור לאיפוס סיסמה");
  expect(await reset.getByRole("textbox").inputValue()).toContain("/activate?token=");

  // the participant is signed in on another browser
  const tctx = await browser.newContext({ storageState: target.storageState, extraHTTPHeaders: clock(T.day4Noon) });
  const tpage = await tctx.newPage();
  await tpage.goto("/today");
  await expect(tpage.getByRole("heading", { level: 1 })).toBeVisible();

  await row.getByRole("button", { name: /השבתת/ }).click();
  await expect(row.getByRole("status").filter({ hasText: "הושבת" })).toBeVisible();
  await page.reload();
  const disabledRow = page.locator("li.adm-item", { hasText: target.username });
  await expect(disabledRow.locator("dd").nth(5)).toHaveText("כן");
  await expect(disabledRow.getByRole("button", { name: /קישור/ })).toHaveCount(0); // no new links for a disabled user
  expect((await pool.query("select count(*)::int n from sessions where user_id = $1", [target.userId])).rows[0].n).toBe(0);

  await tpage.goto("/today");
  await expect(tpage).toHaveURL(/\/login/);
  await tpage.getByLabel("שם משתמש, טלפון או מייל").fill(target.username);
  await tpage.getByLabel("סיסמה", { exact: true }).fill("today-pass-12");
  await tpage.getByRole("button", { name: "כניסה", exact: true }).click();
  await expect(tpage.locator("#login-form-err")).toHaveText("הפרטים או הסיסמה לא נכונים");

  await disabledRow.getByRole("button", { name: /הפעלה מחדש/ }).click();
  await expect(disabledRow.getByRole("status").filter({ hasText: "הופעל" })).toBeVisible();
  await tpage.getByLabel("שם משתמש, טלפון או מייל").fill(target.username);
  await tpage.getByLabel("סיסמה", { exact: true }).fill("today-pass-12");
  await tpage.getByRole("button", { name: "כניסה", exact: true }).click();
  await tpage.waitForURL("**/today");
  await tctx.close();

  // delete: first step is a confirmation page, a wrong confirmation deletes nothing
  await page.goto(`/admin/participants?q=${target.username}`);
  await page.locator("li.adm-item", { hasText: target.username }).getByRole("link", { name: /מחיקת/ }).click();
  await expect(page.getByRole("heading", { name: "מחיקה לצמיתות" })).toBeVisible();
  await axe(page);
  await page.getByLabel("שם המשתמש לאישור").fill("wrong");
  await page.getByRole("button", { name: "מחיקה סופית" }).click();
  await expect(page.locator(".adm-msg--err")).toContainText("לא תואם");
  expect((await pool.query("select count(*)::int n from users where id = $1", [target.userId])).rows[0].n).toBe(1);
  await page.getByLabel("שם המשתמש לאישור").fill(target.username);
  await page.getByRole("button", { name: "מחיקה סופית" }).click();
  await expect(page.getByRole("status").filter({ hasText: "המשתתף נמחק" })).toBeVisible();
  expect((await pool.query("select count(*)::int n from users where id = $1", [target.userId])).rows[0].n).toBe(0);
  await ctx.close();
});

test("an admin cannot disable or delete their own account, and has no such buttons", async ({ browser }) => {
  const { ctx, page } = await adminCtx(browser);
  await page.goto(`/admin/participants?q=${admin.username}`);
  const row = page.locator("li.adm-item", { hasText: "e2eadmin" });
  await expect(row).toContainText("(החשבון שלכם)");
  await expect(row.getByRole("button")).toHaveCount(0);
  await page.goto(`/admin/participants?delete=${admin.userId}`);
  await expect(page.getByRole("heading", { name: "מחיקה לצמיתות" })).toHaveCount(0);
  await ctx.close();
});

test("a server action replayed with a foreign Origin is refused", async ({ browser }) => {
  const { ctx, page } = await adminCtx(browser);
  await page.goto("/admin/participants");
  let body: string | null = null;
  let headers: Record<string, string> = {};
  await page.route("**/admin/participants", async (route) => {
    const req = route.request();
    if (req.method() === "POST" && !body) {
      body = req.postData();
      headers = await req.allHeaders();
      await route.abort();
    } else await route.continue();
  });
  await page.getByLabel("שם", { exact: true }).fill("אורח");
  await page.getByLabel(/^טלפון/).first().fill("0521112222");
  await page.getByRole("button", { name: "יצירה וקבלת קישור" }).click();
  await expect.poll(() => body).not.toBeNull();
  const before = (await pool.query("select count(*)::int n from users")).rows[0].n;
  const res = await ctx.request.post("/admin/participants", {
    headers: { ...headers, origin: "https://evil.example" },
    data: body!,
    maxRedirects: 0,
  });
  expect(await res.text()).not.toContain("/activate?token=");
  expect((await pool.query("select count(*)::int n from users")).rows[0].n).toBe(before);
  await ctx.close();
});

test.describe("day preview", () => {
  test("banner on app pages shows day N, the path and day views follow, stop clears it; marking yesterday does not crash", async ({ browser }) => {
    const { ctx, page } = await adminCtx(browser);
    await page.goto("/admin/participants");
    await page.getByLabel("יום", { exact: true }).selectOption("9");
    await page.getByRole("button", { name: "הפעלת תצוגה מקדימה" }).click();
    await page.waitForURL("**/today");
    const banner = page.getByTestId("preview-banner");
    await expect(banner).toContainText("מצב תצוגה מקדימה: יום 9");
    await expect(page.locator(".chip", { hasText: "יום 9 מתוך 14" })).toBeVisible();
    await axe(page);

    const cookies = await ctx.cookies();
    const pc = cookies.find((c) => c.name.endsWith("tsaad_preview"))!;
    expect(pc.httpOnly).toBe(true);
    expect(pc.sameSite).toBe("Lax");
    expect(pc.value).not.toContain("e2eadmin");

    await page.goto("/path");
    await expect(banner).toBeVisible();
    await page.goto("/day/8"); // yesterday of day 9: markable
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("יום 8");
    await expect(banner).toBeVisible();
    const first = page.locator('main button[aria-pressed="false"]').first();
    await first.click();
    await expect(page.locator('main button[aria-pressed="true"]').first()).toBeVisible(); // the mark was saved for yesterday
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("יום 8"); // no crash after marking
    await page.goto("/day/3"); // older day: read-only
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("יום 3");
    await page.goto("/day/12"); // not yet open on day 9
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await banner.getByRole("button", { name: "הפסקת מצב התצוגה המקדימה" }).click();
    await page.waitForURL("**/admin/participants");
    await page.goto("/today");
    await expect(page.getByTestId("preview-banner")).toHaveCount(0);
    await expect(page.locator(".chip", { hasText: "יום 4 מתוך 14" })).toBeVisible(); // back to the real (test-clock) day
    await ctx.close();
  });

  test("a non-admin is never affected, even with a cookie they signed or forged", async ({ browser }) => {
    const s = await createUser(browser, "forger");
    const ctx = await browser.newContext({ storageState: s.storageState, extraHTTPHeaders: clock(T.day4Noon), locale: "he-IL" });
    const future = Math.floor(Date.now() / 1000) + 3600;
    // the admin's own genuine cookie (value) copied to another user, and a made-up signature
    const { ctx: actx, page: apage } = await adminCtx(browser);
    await apage.goto("/admin/participants");
    await apage.getByLabel("יום", { exact: true }).selectOption("12");
    await apage.getByRole("button", { name: "הפעלת תצוגה מקדימה" }).click();
    await apage.waitForURL("**/today");
    const genuine = (await actx.cookies()).find((c) => c.name.endsWith("tsaad_preview"))!.value;
    await actx.close();
    for (const value of [genuine, `v1.12.${future}.${randomBytes(32).toString("hex")}`]) {
      await ctx.addCookies([{ name: "__Host-tsaad_preview", value, domain: "localhost", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
      const page = await ctx.newPage();
      await page.goto("/today");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByTestId("preview-banner")).toHaveCount(0);
      await expect(page.locator(".chip", { hasText: "יום 4 מתוך 14" })).toBeVisible();
      await page.close();
    }
    await ctx.close();
  });
});
