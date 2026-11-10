// @vitest-environment node
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REMINDERS } from "@/config/constants";
import { createDb, isLocalDatabaseUrl, schema, type Db } from "@/db";
import { fakeSubscription } from "../../../test/push-keys";
import { removeSubscription, saveSubscription } from "./subscription";

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

  it("deleting the user removes their subscriptions", async () => {
    const u = await mkUser();
    await saveSubscription(db, u, fakeSubscription());
    await db.delete(schema.users).where(eq(schema.users.id, u));
    expect(await rowsOf(u)).toHaveLength(0);
  });
});
