import AxeBuilder from "@axe-core/playwright";
import { createHash, randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

/**
 * בדיקות עשן לדפי החשבון: אפס הפרות axe, והזרימה המלאה (הפעלה, כניסה, שכחתי סיסמה).
 * נוצרים משתמשים וקישורים ישירות במסד הזמני (רק hash של האסימון נשמר, כמו באפליקציה).
 */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(() => pool.end());

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const uname = (p: string) => `${p}-${randomBytes(3).toString("hex")}`;

async function mkUser(username: string, passwordHash: string | null = null) {
  const r = await pool.query(
    `insert into users (username, display_name, email, phone, password_hash)
     values ($1, 'בדיקה', $2, '050-111-2222', $3) returning id`,
    [username, `${username}@example.test`, passwordHash],
  );
  return r.rows[0].id as string;
}

async function mkToken(userId: string, purpose: "activate" | "reset" = "activate", minutes = 30) {
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `insert into activation_tokens (user_id, token_hash, purpose, expires_at)
     values ($1, $2, $3, now() + make_interval(mins => $4))`,
    [userId, sha(token), purpose, minutes],
  );
  return token;
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`)).toEqual([]);
}

const cookieNamed = async (page: Page, name: string) =>
  (await page.context().cookies()).find((c) => c.name === name);

test.describe("axe: zero violations", () => {
  test("/login, and the failed-login and required-field states", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("כניסה לאתגר");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await axe(page);

    await page.getByRole("button", { name: "כניסה", exact: true }).click();
    await expect(page.getByText("יש להזין שם משתמש.")).toBeVisible();
    await expect(page.getByLabel("שם משתמש", { exact: true })).toBeFocused();
    await axe(page);

    await page.getByLabel("שם משתמש", { exact: true }).fill("nobody");
    await page.getByLabel("סיסמה", { exact: true }).fill("wrong-pass-1");
    await page.getByRole("button", { name: "כניסה", exact: true }).click();
    await expect(page.locator("#login-form-err")).toHaveText("שם המשתמש או הסיסמה לא נכונים");
    await expect(page.getByLabel("שם משתמש", { exact: true })).toBeFocused();
    await expect(page.getByLabel("שם משתמש", { exact: true })).toHaveValue("nobody");
    await axe(page);
  });

  test("/forgot and its confirmation state", async ({ page }) => {
    await page.goto("/forgot");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("שכחתי סיסמה");
    await axe(page);

    await page.getByLabel("שם משתמש, טלפון או מייל").fill("whoever");
    await page.getByRole("button", { name: "שליחת קישור" }).click();
    await expect(page.getByRole("heading", { name: "אם הפרטים נכונים, יגיע קישור" })).toBeFocused();
    await axe(page);
  });

  test("/activate: valid link, validation errors, and expired state", async ({ page }) => {
    const token = await mkToken(await mkUser(uname("axe")));
    await page.goto(`/activate?token=${token}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("בוחרים סיסמה ומתחילים");
    await expect(page.getByLabel("שם המשתמש")).toHaveAttribute("readonly", "");
    await axe(page);

    await page.getByLabel("בחירת סיסמה", { exact: true }).fill("abcdefg1");
    await page.getByLabel("אימות הסיסמה", { exact: true }).fill("abcdefg2");
    await page.getByRole("button", { name: "שמירה וכניסה" }).click();
    await expect(page.getByText("הסיסמאות לא זהות. כדאי להקליד שוב.")).toBeVisible();
    await expect(page.getByLabel("אימות הסיסמה", { exact: true })).toBeFocused();
    await axe(page);

    await page.goto("/activate?token=not-a-real-token");
    await expect(page.getByRole("heading", { name: "הקישור כבר לא בתוקף" })).toBeFocused();
    await expect(page.getByRole("link", { name: "שליחת קישור חדש" })).toHaveAttribute("href", "/forgot");
    await axe(page);

    await page.goto("/activate");
    await expect(page.getByRole("heading", { name: "הקישור כבר לא בתוקף" })).toBeVisible();
  });
});

test.describe("flows", () => {
  test("activation: choose a password, signed in with a secure cookie, link works once", async ({ page, context }) => {
    const username = uname("flow");
    const token = await mkToken(await mkUser(username));
    await page.goto(`/activate?token=${token}`);
    await expect(page.getByLabel("שם המשתמש")).toHaveValue(username);

    await page.getByLabel("בחירת סיסמה", { exact: true }).fill("short1");
    await page.getByRole("button", { name: "שמירה וכניסה" }).click();
    await expect(page.getByText("הסיסמה קצרה מדי. נדרשים לפחות 8 תווים.")).toBeVisible();
    await page.getByLabel("בחירת סיסמה", { exact: true }).fill("nodigitshere");
    await page.getByLabel("אימות הסיסמה", { exact: true }).fill("nodigitshere");
    await page.getByRole("button", { name: "שמירה וכניסה" }).click();
    await expect(page.getByText("הסיסמה צריכה לכלול לפחות ספרה אחת.")).toBeVisible();

    await page.getByLabel("בחירת סיסמה", { exact: true }).fill("good-pass-12");
    await page.getByLabel("אימות הסיסמה", { exact: true }).fill("good-pass-12");
    await page.getByRole("button", { name: "שמירה וכניסה" }).click();
    await page.waitForURL("**/today");

    const cookie = await cookieNamed(page, "__Host-tsaad_session");
    expect(cookie).toBeTruthy();
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
    expect(cookie!.value).not.toContain("good-pass");

    // the link is single-use
    await context.clearCookies();
    await page.goto(`/activate?token=${token}`);
    await expect(page.getByRole("heading", { name: "הקישור כבר לא בתוקף" })).toBeVisible();
  });

  test("login: right password signs in, a signed-in visitor skips /login", async ({ page }) => {
    const username = uname("login");
    const token = await mkToken(await mkUser(username));
    await page.goto(`/activate?token=${token}`);
    await page.getByLabel("בחירת סיסמה", { exact: true }).fill("my-pass-1234");
    await page.getByLabel("אימות הסיסמה", { exact: true }).fill("my-pass-1234");
    await page.getByRole("button", { name: "שמירה וכניסה" }).click();
    await page.waitForURL("**/today");
    const first = (await cookieNamed(page, "__Host-tsaad_session"))!.value;

    await page.goto("/login");
    await page.waitForURL("**/today");

    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("שם משתמש", { exact: true }).fill(username);
    await page.getByLabel("סיסמה", { exact: true }).fill("my-pass-1234");
    await page.getByRole("button", { name: "כניסה", exact: true }).click();
    await page.waitForURL("**/today");
    // a new login gets a new opaque session
    expect((await cookieNamed(page, "__Host-tsaad_session"))!.value).not.toBe(first);
  });

  test("forgot: the confirmation is identical for a real and an unknown account", async ({ page }) => {
    const username = uname("known");
    await mkUser(username, "$argon2id$placeholder");
    const texts: string[] = [];
    for (const ident of [username, uname("unknown")]) {
      await page.goto("/forgot");
      await page.getByLabel("שם משתמש, טלפון או מייל").fill(ident);
      await page.getByRole("button", { name: "שליחת קישור" }).click();
      const tile = page.getByRole("status");
      await expect(tile).toBeVisible();
      texts.push((await tile.innerText()).replace(/\s+/g, " "));
    }
    expect(texts[0]).toBe(texts[1]);
    expect(texts[0]).toContain("אם הפרטים נכונים, יגיע קישור");
  });

  test("a forged cross-origin post does not succeed (the exact Origin rules are unit-tested)", async ({ page, request }) => {
    await page.goto("/login");
    const res = await request.post("/login", {
      headers: { origin: "https://evil.example", "next-action": "00" },
      form: { username: "x", password: "y" },
    });
    expect(res.status()).not.toBe(200);
  });
});
