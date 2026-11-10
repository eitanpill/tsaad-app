import { createECDH, randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { T, axe, createUser, expectReflowAndTargets, open, pool, shot, type Session } from "./helpers";

/**
 * /reminders: מצבי ההתראות עם Notification ו־PushManager מדומים (addInitScript). השרת אמיתי: api/push, הבדיקות
 * והמסד אמיתיים. המנוי המדומה מקבל כתובת מרשימת ההיתר ומפתחות P-256 תקינים שנוצרים בכל ריצה.
 * שום שירות push אמיתי לא נקרא, ושום הודעה לא נשלחת.
 */
let s: Session;
test.beforeAll(async ({ browser }) => {
  s = await createUser(browser, "rem");
});
test.beforeEach(async () => {
  await pool.query("delete from push_subscriptions where user_id = $1", [s.userId]);
});

function fakeKeys() {
  const e = createECDH("prime256v1");
  e.generateKeys();
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${randomBytes(8).toString("hex")}`,
    p256dh: e.getPublicKey().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  };
}

type Mock = {
  permission: NotificationPermission;
  request?: NotificationPermission;
  subscribed?: boolean;
  unsupported?: boolean;
  standalone?: boolean;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** Runs in the page before any script: replaces the push APIs with controllable fakes. */
function installMock(m: Mock) {
  const w = window as unknown as Record<string, unknown>;
  if (m.unsupported) {
    delete w.PushManager;
    return;
  }
  const state = { permission: m.permission };
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: {
      get permission() {
        return state.permission;
      },
      requestPermission: async () => {
        w.__asked = ((w.__asked as number) ?? 0) + 1;
        state.permission = m.request ?? "granted";
        return state.permission;
      },
    },
  });
  // window.__endpoint (set by a test) overrides the endpoint of the next subscription.
  const mk = () => {
    const endpoint = (w.__endpoint as string | undefined) ?? m.endpoint;
    return {
      endpoint,
      expirationTime: null,
      toJSON() {
        return { endpoint, expirationTime: null, keys: { p256dh: m.p256dh, auth: m.auth } };
      },
      async unsubscribe() {
        w.__sub = null;
        return true;
      },
    };
  };
  w.__sub = m.subscribed ? mk() : null;
  PushManager.prototype.getSubscription = async () => (w.__sub as PushSubscription | null) ?? null;
  PushManager.prototype.subscribe = async () => {
    w.__subscribeCalls = ((w.__subscribeCalls as number) ?? 0) + 1;
    return (w.__sub = mk() as unknown as PushSubscription) as PushSubscription;
  };
  if (m.standalone) {
    const orig = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => (q.includes("display-mode: standalone") ? ({ ...orig(q), matches: true } as MediaQueryList) : orig(q));
  }
}

async function openReminders(
  browser: Parameters<typeof open>[0],
  m: Partial<Mock> & { permission: NotificationPermission },
  o: { who?: Session } = {},
) {
  const full: Mock = { ...fakeKeys(), ...m };
  const r = await open(browser, o.who ?? s, T.day4Noon, "/reminders", { init: installMock as never, initArg: full });
  return { ...r, mock: full };
}

const sw = (p: Page) => p.getByRole("switch", { name: "התראה בטלפון" });
const status = (p: Page) => p.locator("[role=status].rm-status");
const rows = async () => (await pool.query("select endpoint, p256dh, auth from push_subscriptions where user_id = $1", [s.userId])).rows;

test("static content: hero, the notification preview, the fixed time, and the iPhone note with a link to the guide", async ({ browser }) => {
  const { ctx, page } = await openReminders(browser, { permission: "default" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("תזכורת של בוקר");
  await expect(page.locator(".t-rem-hero p")).toHaveText("הודעה אחת בכל בוקר ב־07:30, אחרי שהיום החדש נפתח. אפשר לכבות בכל רגע.");
  await expect(page.getByRole("region", { name: "דוגמה להתראה: יום 5 נפתח. דבר אחד קטן מספיק." })).toBeVisible();
  await expect(page.locator(".rm-time")).toHaveText("07:30");
  await expect(page.getByText("היום נפתח ב־05:00, והתזכורת מגיעה ב־07:30.")).toBeVisible();
  await expect(page.getByRole("link", { name: "איך מוסיפים למסך הבית" })).toHaveAttribute("href", "/install");
  await expect(page.getByRole("navigation", { name: "ניווט ראשי" }).getByRole("link", { name: "תזכורות" })).toHaveAttribute("aria-current", "page");
  await ctx.close();
});

test("off: the switch is a labelled role=switch, off, with the status in a polite live region; axe + screenshot", async ({ browser }) => {
  const { ctx, page } = await openReminders(browser, { permission: "default" });
  await expect(sw(page)).toHaveAttribute("aria-checked", "false");
  await expect(sw(page)).not.toHaveAttribute("aria-disabled", "true");
  await expect(status(page)).toHaveText("ההתראות כבויות");
  await expect(status(page)).toHaveAttribute("aria-live", "polite");
  expect(await sw(page).evaluate((e) => e.getAttribute("aria-describedby")!.includes(document.querySelector(".rm-status")!.id))).toBe(true);
  expect((await sw(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expectReflowAndTargets(page);
  await axe(page);
  await shot(page, "reminders-off");
  await ctx.close();
});

test("turning on: asks permission, subscribes, saves the subscription on the server, announces it; keyboard works", async ({ browser }) => {
  const { ctx, page, mock } = await openReminders(browser, { permission: "default" });
  await sw(page).focus();
  await page.keyboard.press("Space");
  await expect(sw(page)).toHaveAttribute("aria-checked", "true");
  await expect(status(page)).toHaveText("ההתראות פעילות");
  await expect(sw(page)).toBeFocused();
  const saved = await rows();
  expect(saved).toEqual([{ endpoint: mock.endpoint, p256dh: mock.p256dh, auth: mock.auth }]);
  await axe(page);
  await shot(page, "reminders-on");

  await ctx.close();
});

test("permission granted and a subscription already in the browser and on the server: shown as on, without asking again", async ({ browser }) => {
  const k = fakeKeys();
  await pool.query("insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)", [s.userId, k.endpoint, k.p256dh, k.auth]);
  const { ctx, page } = await openReminders(browser, { ...k, permission: "granted", subscribed: true });
  await expect(sw(page)).toHaveAttribute("aria-checked", "true");
  await expect(status(page)).toHaveText("ההתראות פעילות");
  expect(await page.evaluate(() => (window as unknown as { __asked?: number }).__asked ?? 0)).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __sub: unknown }).__sub)).not.toBeNull();
  expect(await rows()).toHaveLength(1);
  await ctx.close();
});

test("shared phone: a subscription left in the browser by another user is dropped (browser and server), and shown as off", async ({ browser }) => {
  const other = await createUser(browser, "rem-prev");
  const k = fakeKeys();
  await pool.query("insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)", [other.userId, k.endpoint, k.p256dh, k.auth]);
  const { ctx, page } = await openReminders(browser, { ...k, permission: "granted", subscribed: true });
  await expect(sw(page)).toHaveAttribute("aria-checked", "false");
  await expect(status(page)).toHaveText("ההתראות כבויות");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __sub: unknown }).__sub)).toBeNull();
  const left = await pool.query("select user_id from push_subscriptions where endpoint = $1", [k.endpoint]);
  expect(left.rows).toEqual([]);
  expect(await rows()).toHaveLength(0);
  await ctx.close();
});

test("logout removes this device's subscription on the server and in the browser", async ({ browser }) => {
  const me = await createUser(browser, "rem-out");
  const k = fakeKeys();
  const mine = await pool.query("select count(*)::int as n from push_subscriptions where user_id = $1", [me.userId]);
  expect(mine.rows[0].n).toBe(0);
  const { ctx, page } = await openReminders(browser, { ...k, permission: "default" }, { who: me });
  await sw(page).click();
  await expect(sw(page)).toHaveAttribute("aria-checked", "true");
  // Another device of the same user stays registered.
  const o = fakeKeys();
  await pool.query("insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)", [me.userId, o.endpoint, o.p256dh, o.auth]);
  await page.getByRole("button", { name: "יציאה" }).click();
  await page.waitForURL("**/login");
  const left = await pool.query("select endpoint from push_subscriptions where user_id = $1", [me.userId]);
  expect(left.rows).toEqual([{ endpoint: o.endpoint }]);
  expect(await page.evaluate(() => (window as unknown as { __sub: unknown }).__sub)).toBeNull();
  await ctx.close();
});

test("turning off deletes the subscription on the server and in the browser", async ({ browser }) => {
  const { ctx, page, mock } = await openReminders(browser, { permission: "default" });
  await sw(page).click();
  await expect(sw(page)).toHaveAttribute("aria-checked", "true");
  expect(await rows()).toHaveLength(1);
  await sw(page).press("Enter");
  await expect(sw(page)).toHaveAttribute("aria-checked", "false");
  await expect(status(page)).toHaveText("ההתראות כבויות");
  expect(await rows()).toHaveLength(0);
  expect(await page.evaluate(() => (window as unknown as { __sub: unknown }).__sub)).toBeNull();
  expect(mock.endpoint).toBeTruthy();
  await ctx.close();
});

test("blocked in the phone settings: the switch cannot be turned on, the reason is written", async ({ browser }) => {
  const { ctx, page } = await openReminders(browser, { permission: "denied" });
  await expect(status(page)).toHaveText("ההתראות חסומות בהגדרות הטלפון");
  await expect(sw(page)).toHaveAttribute("aria-disabled", "true");
  await expect(sw(page)).toHaveAttribute("aria-checked", "false");
  await sw(page).click({ force: true });
  expect(await page.evaluate(() => (window as unknown as { __asked?: number }).__asked ?? 0)).toBe(0);
  await axe(page);
  await shot(page, "reminders-blocked");
  await ctx.close();
});

test("the permission prompt answered 'block' ends in the blocked state, nothing saved", async ({ browser }) => {
  const { ctx, page } = await openReminders(browser, { permission: "default", request: "denied" });
  await sw(page).click();
  await expect(status(page)).toHaveText("ההתראות חסומות בהגדרות הטלפון");
  await expect(sw(page)).toHaveAttribute("aria-checked", "false");
  expect(await rows()).toHaveLength(0);
  await ctx.close();
});

test("unsupported browser: off, disabled, with the wording from the copy deck", async ({ browser }) => {
  const { ctx, page } = await openReminders(browser, { permission: "default", unsupported: true });
  await expect(status(page)).toHaveText("הדפדפן הזה לא תומך בהתראות. אפשר להוסיף את האפליקציה למסך הבית ולנסות שוב.");
  await expect(sw(page)).toHaveAttribute("aria-disabled", "true");
  await axe(page);
  await shot(page, "reminders-unsupported");
  await ctx.close();
});

test("a server refusal shows the error, keeps the switch off and leaves no local subscription; retry works", async ({ browser }) => {
  // The server really refuses (400: endpoint not on the allowlist). page.route cannot be used here: once the service
  // worker controls the page, Chromium sends its fetches past page-level routing.
  const { ctx, page, mock } = await openReminders(browser, { permission: "default" });
  await page.evaluate(() => ((window as unknown as { __endpoint: string }).__endpoint = "https://evil.example/not-a-push-service"));
  await sw(page).click();
  await expect(status(page)).toHaveText("לא הצלחנו להפעיל את ההתראות. אפשר לנסות שוב בעוד רגע.");
  await expect(sw(page)).toHaveAttribute("aria-checked", "false");
  expect(await page.evaluate(() => (window as unknown as { __sub: unknown }).__sub)).toBeNull();
  expect(await rows()).toHaveLength(0);
  await axe(page);
  await shot(page, "reminders-error");
  await page.evaluate((e) => ((window as unknown as { __endpoint: string }).__endpoint = e), mock.endpoint);
  await sw(page).click();
  await expect(sw(page)).toHaveAttribute("aria-checked", "true");
  expect(await rows()).toHaveLength(1);
  await ctx.close();
});

test("installed (standalone): the iPhone note is hidden", async ({ browser }) => {
  const { ctx, page } = await openReminders(browser, { permission: "default", standalone: true });
  await expect(page.getByRole("link", { name: "איך מוסיפים למסך הבית" })).toHaveCount(0);
  await ctx.close();
});

test("api/push is protected: no session 401, cross-origin 403, bad endpoint 400", async ({ browser, request }) => {
  const body = fakeKeys();
  const payload = { endpoint: body.endpoint, keys: { p256dh: body.p256dh, auth: body.auth } };
  expect((await request.post("/api/push", { data: payload, headers: { origin: "http://localhost:3100" } })).status()).toBe(401);
  const { ctx } = await openReminders(browser, { permission: "default" });
  expect((await ctx.request.post("/api/push", { data: payload, headers: { origin: "https://evil.example" } })).status()).toBe(403);
  expect((await ctx.request.post("/api/push", { data: { ...payload, endpoint: "https://evil.example/x" }, headers: { origin: "http://localhost:3100" } })).status()).toBe(400);
  expect((await ctx.request.post("/api/push", { data: payload, headers: { origin: "http://localhost:3100" } })).status()).toBe(201);
  expect(await rows()).toHaveLength(1);
  await ctx.close();
});

test("320px reflow", async ({ browser }) => {
  const full: Mock = { ...fakeKeys(), permission: "default" };
  const { ctx, page } = await open(browser, s, T.day4Noon, "/reminders", { width: 320, init: installMock as never, initArg: full });
  await expectReflowAndTargets(page);
  await axe(page);
  await shot(page, "reminders-320");
  await ctx.close();
});
