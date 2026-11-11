import { expect, test } from "@playwright/test";
import { axe, createUser, open, pool, T } from "./helpers";

/** /admin/stats: aggregate numbers for the owner. Only a logged-in user named in ADMIN_USERNAMES (e2eadmin on this server); everyone else gets the normal 404. */

test("logged out and non-admin users get the normal 404 (real status, same page as any unknown address)", async ({ browser, request }) => {
  const out = await request.get("/admin/stats");
  expect(out.status()).toBe(404);
  const unknown = await request.get("/definitely-not-a-page");
  expect((await out.text()).includes("הדף לא נמצא")).toBe(true); // the Hebrew 404 page, not a login redirect
  expect(unknown.status()).toBe(404);

  // logged in but not an admin: the same 404 page with a real 404 status (decided in src/proxy.ts before anything streams)
  const s = await createUser(browser, "notadmin");
  const ctx = await browser.newContext({ storageState: s.storageState });
  const res = await ctx.request.get("/admin/stats");
  expect(res.status()).toBe(404);
  const html = await res.text();
  expect(html.includes("סטטיסטיקה")).toBe(false);
  expect(html.includes("noindex")).toBe(true);
  expect(html.includes("הדף לא נמצא")).toBe(true);
  await ctx.close();
});

test("an admin sees aggregate numbers only, noindex, accessible, with no personal data", async ({ browser }) => {
  const s = await createUser(browser, "adminseed");
  await pool.query("update users set username = 'e2eadmin' where id = $1", [s.userId]);
  await pool.query("insert into action_completions (user_id, day, action) values ($1, 1, 'habit'), ($1, 2, 'habit') on conflict do nothing", [s.userId]);
  await pool.query(
    "insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://fcm.googleapis.com/e2e-admin', 'k', 'a') on conflict do nothing",
    [s.userId],
  );

  const { ctx, page } = await open(browser, s, T.day4Noon, "/admin/stats");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("סטטיסטיקה");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("table", { name: "כמה משתמשים סימנו לפחות פעולה אחת בכל יום" })).toBeVisible();
  const row1 = page.locator("table").first().locator("tbody tr").first();
  await expect(row1.locator("td").first()).not.toHaveText("0");
  const html = await page.content();
  expect(html.includes("e2eadmin")).toBe(false);
  expect(html.includes("@example.test")).toBe(false);
  await axe(page);
  await ctx.close();
});
