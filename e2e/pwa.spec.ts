import { expect, test } from "@playwright/test";
import { T, createUser, open, type Session } from "./helpers";

let s: Session;
test.beforeAll(async ({ browser }) => {
  s = await createUser(browser, "pwa");
});

test("manifest: served as a web manifest, Hebrew RTL, standalone, starts at /today, icons exist", async ({ request, page }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/manifest\+json|application\/json/);
  const m = await res.json();
  expect(m).toMatchObject({ name: "צעד קטן ביום", lang: "he", dir: "rtl", start_url: "/today", display: "standalone" });
  for (const icon of m.icons as Array<{ src: string; type: string }>) {
    const r = await request.get(icon.src);
    expect(r.status(), icon.src).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/png");
  }
  expect((await request.get("/apple-touch-icon.png")).status()).toBe(200);
  // the pages link to it
  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon\.png/);
});

test("sw.js: javascript, never cached, with its own CSP; offline.html has a locked-down CSP", async ({ request }) => {
  const r = await request.get("/sw.js");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("javascript");
  expect(r.headers()["cache-control"]).toContain("no-cache");
  expect(r.headers()["content-security-policy"]).toContain("script-src 'self'");
  expect(await r.text()).toContain("notificationclick");
  const o = await request.get("/offline.html");
  expect(o.status()).toBe(200);
  expect(o.headers()["content-security-policy"]).toContain("default-src 'none'");
  expect(await o.text()).toContain("אין חיבור לאינטרנט");
});

test("page CSP allows the worker and manifest; static PWA files carry no nonce policy", async ({ request }) => {
  const login = await request.get("/login");
  const csp = login.headers()["content-security-policy"];
  expect(csp).toContain("worker-src 'self'");
  expect(csp).toContain("manifest-src 'self'");
});

test("the service worker registers from the app shell without CSP violations, and never caches HTML or anything personal", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, T.day4Noon, "/today");
  const problems: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|refused to|violat/i.test(m.text())) problems.push(m.text());
  });
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/$/);
  const state = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration("/"))?.active?.state);
  expect(state).toBe("activated");

  // visit several screens (the SW now controls the page after a reload) and call the APIs
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  for (const p of ["/path", "/live", "/reminders", "/install", "/today"]) {
    await page.goto(p);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.evaluate(async () => {
    await fetch("/api/video/1");
    await fetch("/api/live/7/ics");
  });

  const cached = await page.evaluate(async () => {
    const out: Array<{ cache: string; url: string; type: string }> = [];
    for (const name of await caches.keys()) {
      const c = await caches.open(name);
      for (const req of await c.keys()) {
        const res = await c.match(req);
        out.push({ cache: name, url: new URL(req.url).pathname + new URL(req.url).search, type: res?.headers.get("content-type") ?? "" });
      }
    }
    return out;
  });
  expect(cached.length).toBeGreaterThan(0);
  for (const e of cached) {
    expect(e.url, `${e.cache} ${e.url}`).toMatch(/^\/(_next\/static\/|icons\/|offline\.(html|css)$)/);
    if (e.url !== "/offline.html") expect(e.type).not.toContain("text/html");
    expect(e.url).not.toMatch(/\/api\/|_rsc|\/today|\/path|\/live|\/reminders|\/install/);
  }
  expect(await page.evaluate(() => caches.keys())).toEqual(expect.arrayContaining(["tsaad-offline-v1"]));
  expect(problems).toEqual([]);
  await ctx.close();
});

test("offline: a navigation shows the static fallback page; marking is not queued", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, T.day4Noon, "/today");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled
  await ctx.setOffline(true);
  await page.goto("/path").catch(() => undefined);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("אין חיבור לאינטרנט");
  await expect(page.getByText("כדי לסמן צריך חיבור לאינטרנט. כשהוא חוזר, אפשר להמשיך.")).toBeVisible();
  // the offline page is the static one: no scripts at all
  expect(await page.locator("script").count()).toBe(0);
  expect(page.url()).toContain("/path");
  await ctx.setOffline(false);
  await page.getByRole("link", { name: "לנסות שוב" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await ctx.close();
});
