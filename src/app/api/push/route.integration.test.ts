// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { REMINDERS } from "@/config/constants";
import { rowsOf } from "@/lib/auth/sql";
import { createDb, isLocalDatabaseUrl, schema, type Db } from "@/db";
import { fakeSubscription } from "../../../../test/push-keys";

const url = process.env.DATABASE_URL;
const runIntegration = !!url && process.env.TSAAD_TEST_DB === "1" && isLocalDatabaseUrl(url);

const session = vi.hoisted(() => ({ current: null as null | { userId: string; username: string; displayName: string } }));
vi.mock("@/lib/auth/dal", () => ({ verifySession: async () => session.current }));

const ORIGIN = "http://localhost:3100";

describe.skipIf(!runIntegration)("/api/push (integration)", () => {
  let db: Db;
  let route: typeof import("./route");
  let n = 0;
  const mkUser = async () => {
    const i = ++n;
    const [u] = await db
      .insert(schema.users)
      .values({ username: `pr${i}`, displayName: "x", email: `pr${i}@example.test`, ghlContactId: `ghl-pr-${i}` })
      .returning();
    return { userId: u.id, username: u.username, displayName: "x" };
  };
  const req = (method: "POST" | "DELETE", body: unknown, headers: Record<string, string> = {}) =>
    new Request(`${ORIGIN}/api/push`, {
      method,
      headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  const count = async (userId: string) =>
    rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from push_subscriptions where user_id = ${userId}`))[0].n;

  beforeAll(async () => {
    process.env.APP_ORIGIN = ORIGIN;
    process.env.SESSION_SECRET = "route-test-secret-0123456789abcdefghij";
    db = createDb(url!);
    route = await import("./route");
  });
  afterAll(async () => {
    await db.execute(sql`delete from users where username like 'pr%'`);
  });
  beforeEach(() => {
    session.current = null;
  });

  it("401 without a session, and nothing is written", async () => {
    const r = await route.POST(req("POST", fakeSubscription()));
    expect(r.status).toBe(401);
  });

  it("403 for a cross-origin or origin-less request, before anything else", async () => {
    session.current = await mkUser();
    expect((await route.POST(req("POST", fakeSubscription(), { origin: "https://evil.example" }))).status).toBe(403);
    expect((await route.POST(req("POST", fakeSubscription(), { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    const noOrigin = new Request(`${ORIGIN}/api/push`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(fakeSubscription()) });
    expect((await route.POST(noOrigin)).status).toBe(403);
    expect((await route.DELETE(req("DELETE", { endpoint: "x" }, { origin: "https://evil.example" }))).status).toBe(403);
    expect(await count(session.current.userId)).toBe(0);
  });

  it("201 on subscribe, 200 on a repeat, and the row belongs to the session user", async () => {
    const u = (session.current = await mkUser());
    const sub = fakeSubscription();
    expect((await route.POST(req("POST", sub))).status).toBe(201);
    expect((await route.POST(req("POST", sub))).status).toBe(200);
    expect(await count(u.userId)).toBe(1);
  });

  it("rejects bad input with 400/413/415: allowlist, keys, JSON, size, content type", async () => {
    session.current = await mkUser();
    const good = fakeSubscription();
    expect((await route.POST(req("POST", { ...good, endpoint: "https://evil.example/x" }))).status).toBe(400);
    expect((await route.POST(req("POST", { ...good, endpoint: "http://fcm.googleapis.com/fcm/send/x" }))).status).toBe(400);
    expect((await route.POST(req("POST", { ...good, keys: { ...good.keys, auth: "short" } }))).status).toBe(400);
    expect((await route.POST(req("POST", { ...good, keys: { p256dh: good.keys.auth, auth: good.keys.auth } }))).status).toBe(400);
    expect((await route.POST(req("POST", "{not json"))).status).toBe(400);
    expect((await route.POST(req("POST", { ...good, pad: "x".repeat(5000) }))).status).toBe(413);
    expect((await route.POST(req("POST", good, { "content-type": "text/plain" }))).status).toBe(415);
    expect(await count(session.current.userId)).toBe(0);
  });

  it(`caps at ${REMINDERS.maxSubscriptionsPerUser} subscriptions per user`, async () => {
    const u = (session.current = await mkUser());
    for (let i = 0; i < REMINDERS.maxSubscriptionsPerUser + 2; i++) {
      expect((await route.POST(req("POST", fakeSubscription()))).status).toBe(201);
    }
    expect(await count(u.userId)).toBe(REMINDERS.maxSubscriptionsPerUser);
  });

  it("an endpoint owned by another user cannot be taken over with different keys (409)", async () => {
    const alice = await mkUser();
    const bob = await mkUser();
    const sub = fakeSubscription();
    session.current = alice;
    expect((await route.POST(req("POST", sub))).status).toBe(201);
    session.current = bob;
    const r = await route.POST(req("POST", { endpoint: sub.endpoint, keys: fakeSubscription().keys }));
    expect(r.status).toBe(409);
    expect(await count(alice.userId)).toBe(1);
    expect(await count(bob.userId)).toBe(0);
  });

  it("DELETE removes only the caller's subscription and is idempotent", async () => {
    const alice = await mkUser();
    const bob = await mkUser();
    const sub = fakeSubscription();
    session.current = alice;
    await route.POST(req("POST", sub));
    session.current = bob;
    expect((await route.DELETE(req("DELETE", { endpoint: sub.endpoint }))).status).toBe(200);
    expect(await count(alice.userId)).toBe(1);
    session.current = alice;
    expect((await route.DELETE(req("DELETE", { endpoint: sub.endpoint }))).status).toBe(200);
    expect((await route.DELETE(req("DELETE", { endpoint: sub.endpoint }))).status).toBe(200);
    expect(await count(alice.userId)).toBe(0);
    expect((await route.DELETE(req("DELETE", {}))).status).toBe(400);
  });

  it("is rate limited per user (429 with Retry-After), and other users are unaffected", async () => {
    const noisy = (session.current = await mkUser());
    let last = 0;
    let retry: string | null = null;
    for (let i = 0; i < 25; i++) {
      const r = await route.DELETE(req("DELETE", { endpoint: "https://fcm.googleapis.com/fcm/send/none" }));
      last = r.status;
      if (r.status === 429) {
        retry = r.headers.get("retry-after");
        break;
      }
    }
    expect(last).toBe(429);
    expect(Number(retry)).toBeGreaterThan(0);
    session.current = await mkUser();
    expect((await route.POST(req("POST", fakeSubscription()))).status).toBe(201);
    expect(noisy.userId).not.toBe(session.current.userId);
  });

  it("a body without Content-Length (streamed) is still capped at PUSH.maxBodyBytes", async () => {
    session.current = await mkUser();
    const big = new TextEncoder().encode(JSON.stringify({ ...fakeSubscription(), pad: "x".repeat(10_000) }));
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < big.length; i += 1000) c.enqueue(big.slice(i, i + 1000));
        c.close();
      },
    });
    const r = new Request(`${ORIGIN}/api/push`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body,
      duplex: "half",
    } as RequestInit);
    expect(r.headers.get("content-length")).toBeNull();
    expect((await route.POST(r)).status).toBe(413);
    expect(await count(session.current.userId)).toBe(0);
  });

  it("POST /api/push/status: registered only for the caller; another user's row for the same device is removed", async () => {
    const status = await import("./status/route");
    const sreq = (body: unknown, headers: Record<string, string> = {}) =>
      new Request(`${ORIGIN}/api/push/status`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
        body: JSON.stringify(body),
      });
    const alice = await mkUser();
    const bob = await mkUser();
    const sub = fakeSubscription();
    expect((await status.POST(sreq(sub))).status).toBe(401);
    session.current = alice;
    expect((await status.POST(sreq(sub, { origin: "https://evil.example" }))).status).toBe(403);
    expect(await (await status.POST(sreq(sub))).json()).toEqual({ registered: false });
    expect((await route.POST(req("POST", sub))).status).toBe(201);
    const ok = await status.POST(sreq(sub));
    expect(await ok.json()).toEqual({ registered: true });
    expect(ok.headers.get("cache-control")).toContain("no-store");
    session.current = bob;
    expect(await (await status.POST(sreq(sub))).json()).toEqual({ registered: false });
    expect(await count(alice.userId)).toBe(0);
    expect(await count(bob.userId)).toBe(0);
  });

  it("responses are never cacheable", async () => {
    session.current = await mkUser();
    const r = await route.POST(req("POST", fakeSubscription()));
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });
});
