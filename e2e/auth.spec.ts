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
    await expect(page.locator("#login-form-err")).toHaveText("שם המשתמש או הסיסמה לא נכונים.");
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
    await expect(page.getByLabel("שם משתמש")).toHaveAttribute("readonly", "");
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
    await expect(page.getByLabel("שם משתמש")).toHaveValue(username);

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
      const tile = page.getByRole("region", { name: "אם הפרטים נכונים, יגיע קישור" });
      await expect(tile).toBeVisible();
      texts.push((await tile.innerText()).replace(/\s+/g, " "));
    }
    expect(texts[0]).toBe(texts[1]);
    expect(texts[0]).toContain("אם הפרטים נכונים, יגיע קישור");
  });

  test("activating in a browser already signed in as someone else ends that other session", async ({ page }) => {
    const first = uname("first");
    const firstId = await mkUser(first);
    await page.goto(`/activate?token=${await mkToken(firstId)}`);
    await page.getByLabel("בחירת סיסמה", { exact: true }).fill("first-pass-1");
    await page.getByLabel("אימות הסיסמה", { exact: true }).fill("first-pass-1");
    await page.getByRole("button", { name: "שמירה וכניסה" }).click();
    await page.waitForURL("**/today");
    const sessionsOf = async (id: string) =>
      (await pool.query("select count(*)::int as n from sessions where user_id = $1", [id])).rows[0].n as number;
    expect(await sessionsOf(firstId)).toBe(1);

    const secondId = await mkUser(uname("second"));
    await page.goto(`/activate?token=${await mkToken(secondId)}`);
    await page.getByLabel("בחירת סיסמה", { exact: true }).fill("second-pass-1");
    await page.getByLabel("אימות הסיסמה", { exact: true }).fill("second-pass-1");
    await page.getByRole("button", { name: "שמירה וכניסה" }).click();
    await page.waitForURL("**/today");
    expect(await sessionsOf(firstId)).toBe(0);
    expect(await sessionsOf(secondId)).toBe(1);
  });

  test("forgot: after a rate-limit error the typed value stays and the field is focused", async ({ page }) => {
    const ident = uname("again");
    await page.goto("/forgot");
    const field = page.getByLabel("שם משתמש, טלפון או מייל");
    for (let i = 0; i < 4; i++) {
      await field.fill(ident);
      await page.getByRole("button", { name: "שליחת קישור" }).click();
      await expect(page.getByRole("button", { name: "שליחת קישור" })).toBeEnabled();
    }
    await expect(page.locator("#identifier-err")).toBeVisible();
    await expect(field).toBeFocused();
    await expect(field).toHaveValue(ident);
  });

  test("a real login action replayed with a foreign or missing Origin does not sign in", async ({ page, request }) => {
    const username = uname("csrf");
    const token = await mkToken(await mkUser(username));
    await page.goto(`/activate?token=${token}`);
    await page.getByLabel("בחירת סיסמה", { exact: true }).fill("csrf-pass-123");
    await page.getByLabel("אימות הסיסמה", { exact: true }).fill("csrf-pass-123");
    await page.getByRole("button", { name: "שמירה וכניסה" }).click();
    await page.waitForURL("**/today");
    await page.context().clearCookies();

    // capture the genuine server-action request the browser sends for a correct login…
    await page.goto("/login");
    let captured: { headers: Record<string, string>; body: Buffer } | undefined;
    await page.route("**/login", async (route) => {
      const req = route.request();
      if (req.method() === "POST" && !captured) {
        captured = { headers: req.headers(), body: req.postDataBuffer()! };
        return route.abort();
      }
      return route.continue();
    });
    await page.getByLabel("שם משתמש", { exact: true }).fill(username);
    await page.getByLabel("סיסמה", { exact: true }).fill("csrf-pass-123");
    await page.getByRole("button", { name: "כניסה", exact: true }).click();
    await expect.poll(() => !!captured).toBe(true);

    // …and replay it from "another site": same body and action id, only the Origin differs
    const replay = async (origin: string | null) => {
      const headers = { ...captured!.headers };
      delete headers["content-length"];
      delete headers.referer;
      if (origin) headers.origin = origin;
      else delete headers.origin;
      return request.post("/login", { headers, data: captured!.body, maxRedirects: 0 });
    };
    for (const origin of ["https://evil.example", "null", null]) {
      const res = await replay(origin);
      expect(res.status(), String(origin)).toBe(500);
      expect(res.headers()["set-cookie"] ?? "", String(origin)).not.toContain("tsaad_session");
    }
    // control: the same replay with the app's own Origin does sign in
    const ok = await replay("http://localhost:3100");
    expect(ok.status()).not.toBe(500);
    expect(ok.headers()["set-cookie"] ?? "").toContain("tsaad_session");
  });

  test("without JavaScript (or before hydration) the login form still signs in", async ({ browser }) => {
    // with Referrer-Policy no-referrer this post carried "Origin: null" and was rejected (500)
    const username = uname("nojs");
    const token = await mkToken(await mkUser(username));
    const js = await browser.newContext({ locale: "he-IL" });
    const setup = await js.newPage();
    await setup.goto(`/activate?token=${token}`);
    await setup.getByLabel("בחירת סיסמה", { exact: true }).fill("nojs-pass-12");
    await setup.getByLabel("אימות הסיסמה", { exact: true }).fill("nojs-pass-12");
    await setup.getByRole("button", { name: "שמירה וכניסה" }).click();
    await setup.waitForURL("**/today");
    await js.close();

    const ctx = await browser.newContext({ javaScriptEnabled: false, locale: "he-IL" });
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.locator("#username").fill(username);
    await page.locator('input[name="password"]').fill("nojs-pass-12");
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST"),
      page.locator('button[type="submit"]').click(),
    ]);
    expect(res.request().headers().origin).toBe("http://localhost:3100");
    expect(res.status()).toBeLessThan(500);
    await page.waitForURL("**/today");
    expect((await ctx.cookies()).some((c) => c.name === "__Host-tsaad_session")).toBe(true);
    await ctx.close();
  });

  test("auth pages send no Referer off-site and /activate is never cached", async ({ request }) => {
    for (const path of ["/login", "/forgot", "/activate?token=x"]) {
      const res = await request.get(path);
      expect(res.headers()["referrer-policy"], path).toBe("same-origin");
      expect(await res.text(), path).toContain('<meta name="referrer" content="same-origin"/>');
    }
    const act = await request.get("/activate?token=x");
    expect(act.headers()["cache-control"]).toContain("no-store");
  });
});
