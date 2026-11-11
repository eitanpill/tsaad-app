import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

/**
 * GHL signup webhook, end to end against the built app: POST the webhook, read the link from the e2e-only capture file
 * (real sending is off), open it, choose a password, log in. The fake secret and capture file come from playwright.config.ts.
 */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(() => pool.end());

const SECRET = process.env.GHL_WEBHOOK_SECRET!;
const FILE = process.env.TSAAD_WEBHOOK_CAPTURE_FILE!;
const captured = () =>
  readFileSync(FILE, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as { userId: string; username: string; link: string });

test("signup webhook -> activation link -> choose password -> login", async ({ request, page }) => {
  const id = randomBytes(4).toString("hex");
  const email = `whe2e${id}@example.test`;
  const body = { contact_id: `e2e-ghl-${id}`, first_name: "דנה", last_name: "בדיקה", email, phone: "052-123-4567" };

  const denied = await request.post("/api/webhooks/ghl/signup", { data: body, headers: { "x-tsaad-webhook-secret": "wrong" } });
  expect(denied.status()).toBe(401);

  const res = await request.post("/api/webhooks/ghl/signup", { data: body, headers: { "x-tsaad-webhook-secret": SECRET } });
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toBe("no-store");
  expect(await res.json()).toEqual({ ok: true, status: "created" });

  // delivery runs in after(): wait for the capture line
  await expect.poll(() => captured().filter((c) => c.username === `whe2e${id}`).length, { timeout: 10_000 }).toBe(1);
  const { username, link } = captured().find((c) => c.username === `whe2e${id}`)!;

  const again = await request.post("/api/webhooks/ghl/signup", { data: body, headers: { "x-tsaad-webhook-secret": SECRET } });
  expect((await again.json()).status).toBe("duplicate");

  await page.goto(link);
  await page.getByLabel("בחירת סיסמה", { exact: true }).fill("webhook-flow-pass-1");
  await page.getByLabel("אימות הסיסמה", { exact: true }).fill("webhook-flow-pass-1");
  await page.getByRole("button", { name: "שמירה וכניסה" }).click();
  await page.waitForURL("**/today");

  // the link was one-time, and the chosen password works from a fresh login
  await page.context().clearCookies();
  await page.goto(link);
  await expect(page.getByLabel("בחירת סיסמה", { exact: true })).toHaveCount(0);
  await page.goto("/login");
  await page.getByLabel("שם משתמש, טלפון או מייל").fill(username);
  await page.getByLabel("סיסמה", { exact: true }).fill("webhook-flow-pass-1");
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await page.waitForURL("**/today");

  await pool.query("delete from users where username = $1", [username]);
});
