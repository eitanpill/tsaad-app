// @vitest-environment node
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REMINDERS } from "@/config/constants";
import { createDb, isLocalDatabaseUrl, schema, type Db } from "@/db";
import { fakeSubscription } from "../../../test/push-keys";
import { createSession } from "@/lib/auth/session";
import { checkSubscription, removeSubscription, removeSubscriptionForSession, saveSubscription } from "./subscription";

const url = process.env.DATABASE_URL;
const runIntegration = !!url && process.env.TSAAD_TEST_DB === "1" && isLocalDatabaseUrl(url);

describe.skipIf(!runIntegration)("push subscriptions (integration)", () => {
  let db: Db;
  let n = 0;
  const mkUser = async () => {
    const i = ++n;
    const [u] = await db
      .insert(schema.users)
      .values({ username: `ps${i}`, displayName: "x", email: `ps${i}@example.test`, ghlContactId: `ghl-ps-${i}` })
      .returning();
    return u.id;
  };
  const rowsOf = (userId: string) =>
    db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, userId));

  beforeAll(() => {
    db = createDb(url!);
  });
  afterAll(async () => {
    await db.execute(sql`delete from users where username like 'ps%'`);
  });

  it("stores a subscription and upserts by endpoint (same user: keys refresh, one row)", async () => {
    const u = await mkUser();
    const a = fakeSubscription();
    expect(await saveSubscription(db, u, a)).toEqual({ ok: true, created: true, evicted: 0 });
    const b = { endpoint: a.endpoint, keys: fakeSubscription().keys };
    expect(await saveSubscription(db, u, b)).toEqual({ ok: true, created: false, evicted: 0 });
    const rows = await rowsOf(u);
    expect(rows).toHaveLength(1);
    expect(rows[0].p256dh).toBe(b.keys.p256dh);
  });

  it(`caps a user at ${REMINDERS.maxSubscriptionsPerUser} devices and evicts the oldest`, async () => {
    const u = await mkUser();
    const subs = Array.from({ length: REMINDERS.maxSubscriptionsPerUser }, () => fakeSubscription());
    for (const s of subs) await saveSubscription(db, u, s);
    expect(await rowsOf(u)).toHaveLength(REMINDERS.maxSubscriptionsPerUser);
    const extra = fakeSubscription();
    expect(await saveSubscription(db, u, extra)).toMatchObject({ ok: true, evicted: 1 });
    const endpoints = (await rowsOf(u)).map((r) => r.endpoint);
    expect(endpoints).toHaveLength(REMINDERS.maxSubscriptionsPerUser);
    expect(endpoints).not.toContain(subs[0].endpoint); // the oldest is gone
    expect(endpoints).toContain(extra.endpoint);
  });

  it("re-subscribing an existing endpoint makes it the newest (it is the last to be evicted)", async () => {
    const u = await mkUser();
    const subs = Array.from({ length: REMINDERS.maxSubscriptionsPerUser }, () => fakeSubscription());
    for (const s of subs) await saveSubscription(db, u, s);
    await saveSubscription(db, u, subs[0]); // refresh the oldest
    await saveSubscription(db, u, fakeSubscription());
    const endpoints = (await rowsOf(u)).map((r) => r.endpoint);
    expect(endpoints).toContain(subs[0].endpoint);
    expect(endpoints).not.toContain(subs[1].endpoint);
  });

  it("concurrent registrations never exceed the cap", async () => {
    const u = await mkUser();
    await Promise.all(Array.from({ length: 12 }, () => saveSubscription(db, u, fakeSubscription())));
    expect(await rowsOf(u)).toHaveLength(REMINDERS.maxSubscriptionsPerUser);
  });

  it("moves an endpoint to another user only with the same keys (shared device); different keys are a conflict", async () => {
    const alice = await mkUser();
    const bob = await mkUser();
    const sub = fakeSubscription();
    await saveSubscription(db, alice, sub);

    // someone who knows only the endpoint cannot take it over
    expect(await saveSubscription(db, bob, { endpoint: sub.endpoint, keys: fakeSubscription().keys })).toEqual({ ok: false, error: "conflict" });
    expect(await rowsOf(alice)).toHaveLength(1);
    expect(await rowsOf(bob)).toHaveLength(0);

    // the same device (same keys), signed in as bob: the subscription moves, and alice no longer gets it
    expect(await saveSubscription(db, bob, sub)).toMatchObject({ ok: true, created: true });
    expect(await rowsOf(alice)).toHaveLength(0);
    expect(await rowsOf(bob)).toHaveLength(1);
  });

  it("removes only the caller's own subscription, idempotently", async () => {
    const alice = await mkUser();
    const bob = await mkUser();
    const sub = fakeSubscription();
    await saveSubscription(db, alice, sub);
    expect(await removeSubscription(db, bob, sub.endpoint)).toBe(0);
    expect(await rowsOf(alice)).toHaveLength(1);
    expect(await removeSubscription(db, alice, sub.endpoint)).toBe(1);
    expect(await removeSubscription(db, alice, sub.endpoint)).toBe(0);
  });

  it("a concurrent takeover with different keys never writes (the upsert re-checks owner or keys)", async () => {
    const alice = await mkUser();
    const bob = await mkUser();
    const sub = fakeSubscription();
    const other = { endpoint: sub.endpoint, keys: fakeSubscription().keys };
    const results = await Promise.all([saveSubscription(db, alice, sub), saveSubscription(db, bob, other)]);
    const rows = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, sub.endpoint));
    expect(rows).toHaveLength(1);
    // whoever won, the stored keys belong to the winner, and the loser got a conflict
    const winner = rows[0].userId === alice ? 0 : 1;
    expect(results[winner]).toMatchObject({ ok: true });
    expect(results[1 - winner]).toEqual({ ok: false, error: "conflict" });
    expect(rows[0].p256dh).toBe(winner === 0 ? sub.keys.p256dh : other.keys.p256dh);
  });

  it("checkSubscription: true only for the caller with the same keys; another user's row for the same device is removed", async () => {
    const alice = await mkUser();
    const bob = await mkUser();
    const sub = fakeSubscription();
    expect(await checkSubscription(db, alice, sub)).toBe(false); // nothing stored
    await saveSubscription(db, alice, sub);
    expect(await checkSubscription(db, alice, sub)).toBe(true);
    expect(await checkSubscription(db, alice, { endpoint: sub.endpoint, keys: fakeSubscription().keys })).toBe(false);
    // knowing only the endpoint is not enough to delete alice's row
    expect(await checkSubscription(db, bob, { endpoint: sub.endpoint, keys: fakeSubscription().keys })).toBe(false);
    expect(await rowsOf(alice)).toHaveLength(1);
    // the same device, now signed in as bob: alice's row goes (and is not moved to bob)
    expect(await checkSubscription(db, bob, sub)).toBe(false);
    expect(await rowsOf(alice)).toHaveLength(0);
    expect(await rowsOf(bob)).toHaveLength(0);
  });

  it("removeSubscriptionForSession deletes only the session user's row for that endpoint", async () => {
    const alice = await mkUser();
    const bob = await mkUser();
    const a = fakeSubscription();
    const b = fakeSubscription();
    await saveSubscription(db, alice, a);
    await saveSubscription(db, bob, b);
    const { token } = await createSession(db, alice);
    expect(await removeSubscriptionForSession(db, token, b.endpoint)).toBe(0); // bob's device: untouched
    expect(await rowsOf(bob)).toHaveLength(1);
    expect(await removeSubscriptionForSession(db, "not-a-session", a.endpoint)).toBe(0);
    expect(await removeSubscriptionForSession(db, token, a.endpoint)).toBe(1);
    expect(await rowsOf(alice)).toHaveLength(0);
    expect(await removeSubscriptionForSession(db, token, "")).toBe(0);
  });

  it("deleting the user removes their subscriptions", async () => {
    const u = await mkUser();
    await saveSubscription(db, u, fakeSubscription());
    await db.delete(schema.users).where(eq(schema.users.id, u));
    expect(await rowsOf(u)).toHaveLength(0);
  });
});
