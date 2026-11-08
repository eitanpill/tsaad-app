// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, isLocalDatabaseUrl, schema, type Db } from ".";

const url = process.env.DATABASE_URL;
// הבדיקות מוחקות את כל המשתמשים: רצות רק מול מסד זמני של scripts/test-db.sh (localhost + דגל).
const runIntegration = !!url && process.env.TSAAD_TEST_DB === "1" && isLocalDatabaseUrl(url);

describe("isLocalDatabaseUrl", () => {
  it("accepts only loopback hosts", () => {
    expect(isLocalDatabaseUrl("postgres://u@localhost:5432/x")).toBe(true);
    expect(isLocalDatabaseUrl("postgres://u@127.0.0.1:1/x")).toBe(true);
    expect(isLocalDatabaseUrl("postgres://u@db.example.com/x")).toBe(false);
    expect(isLocalDatabaseUrl("postgres://u@localhost.evil.com/x")).toBe(false);
    expect(isLocalDatabaseUrl("not a url")).toBe(false);
  });
});

// Skips cleanly when DATABASE_URL is unset. Run with: scripts/test-db.sh run -- npx vitest run
describe.skipIf(!runIntegration)("database (integration)", () => {
  let db: Db;
  let end: () => Promise<void>;
  const { users } = schema;

  beforeAll(() => {
    db = createDb(url!);
    // node-postgres pool is reachable through $client
    end = async () => {
      await (db as unknown as { $client: { end(): Promise<void> } }).$client.end();
    };
  });
  afterAll(async () => {
    await db.delete(users);
    await end();
  });

  const newUser = async (username: string) =>
    (await db.insert(users).values({ username, displayName: "Test", email: `${username}@example.test` }).returning())[0];

  it("creates a user with nullable password/ghl id and defaults", async () => {
    const u = await newUser("alice");
    expect(u.passwordHash).toBeNull();
    expect(u.ghlContactId).toBeNull();
    expect(u.activatedAt).toBeNull();
    expect(u.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("enforces lowercase, unique usernames and unique ghl ids (nulls allowed repeatedly)", async () => {
    await expect(newUser("Bob")).rejects.toThrow();
    await newUser("bob");
    await expect(newUser("bob")).rejects.toThrow();
    await db.insert(users).values({ username: "c1", displayName: "c", email: "c1@x.test", ghlContactId: "g1" });
    await expect(
      db.insert(users).values({ username: "c2", displayName: "c", email: "c2@x.test", ghlContactId: "g1" }),
    ).rejects.toThrow();
    await db.insert(users).values({ username: "c3", displayName: "c", email: "c3@x.test" });
  });

  it("enforces uniqueness and checks on progress tables", async () => {
    const u = await newUser("dana");
    const c = schema.actionCompletions;
    await db.insert(c).values({ userId: u.id, day: 1, action: "habit" });
    await expect(db.insert(c).values({ userId: u.id, day: 1, action: "habit" })).rejects.toThrow();
    await db.insert(c).values({ userId: u.id, day: 1, action: "move" });
    await expect(db.insert(c).values({ userId: u.id, day: 15, action: "habit" })).rejects.toThrow();
    await expect(db.insert(c).values({ userId: u.id, day: 0, action: "habit" })).rejects.toThrow();
    // action must fit the day: live only on 7/14, move/meditate never on 7/14
    await expect(db.insert(c).values({ userId: u.id, day: 3, action: "live" })).rejects.toThrow();
    await expect(db.insert(c).values({ userId: u.id, day: 7, action: "move" })).rejects.toThrow();
    await expect(db.insert(c).values({ userId: u.id, day: 14, action: "meditate" })).rejects.toThrow();
    await db.insert(c).values({ userId: u.id, day: 7, action: "live" });
    await db.insert(c).values({ userId: u.id, day: 7, action: "habit" });

    const l = schema.liveAttendance;
    await db.insert(l).values({ userId: u.id, day: 7, attended: true });
    await expect(db.insert(l).values({ userId: u.id, day: 7, attended: false })).rejects.toThrow();
    await expect(db.insert(l).values({ userId: u.id, day: 8, attended: true })).rejects.toThrow();

    const r = schema.reminderLog;
    await db.insert(r).values({ userId: u.id, date: "2026-12-02", status: "dry_run" });
    await expect(db.insert(r).values({ userId: u.id, date: "2026-12-02", status: "sent" })).rejects.toThrow();

    const w = schema.webhookEvents;
    await db.insert(w).values({ eventId: "evt-1" });
    await expect(db.insert(w).values({ eventId: "evt-1" })).rejects.toThrow();
  });

  it("stores only hashes with unique token_hash; purpose is constrained", async () => {
    const u = await newUser("eve");
    const t = schema.activationTokens;
    const exp = new Date(Date.now() + 60_000);
    await db.insert(t).values({ userId: u.id, tokenHash: "h1", purpose: "activate", expiresAt: exp });
    await expect(
      db.insert(t).values({ userId: u.id, tokenHash: "h1", purpose: "reset", expiresAt: exp }),
    ).rejects.toThrow();
    await expect(
      db.insert(t).values({ userId: u.id, tokenHash: "h2", purpose: "bogus" as never, expiresAt: exp }),
    ).rejects.toThrow();
    await db.insert(schema.sessions).values({ userId: u.id, tokenHash: "s1", expiresAt: exp });
    await expect(
      db.insert(schema.sessions).values({ userId: u.id, tokenHash: "s1", expiresAt: exp }),
    ).rejects.toThrow();
  });

  it("deleting a user cascades to every table holding personal data", async () => {
    const u = await newUser("frank");
    const exp = new Date(Date.now() + 60_000);
    await db.insert(schema.activationTokens).values({ userId: u.id, tokenHash: "f-a", purpose: "activate", expiresAt: exp });
    await db.insert(schema.sessions).values({ userId: u.id, tokenHash: "f-s", expiresAt: exp });
    await db.insert(schema.loginAttempts).values({ identifierHash: "i", ipHash: "p", userId: u.id });
    await db.insert(schema.actionCompletions).values({ userId: u.id, day: 2, action: "habit" });
    await db.insert(schema.liveAttendance).values({ userId: u.id, day: 14, attended: false });
    await db.insert(schema.pushSubscriptions).values({ userId: u.id, endpoint: "https://push.example/f", p256dh: "k", auth: "a" });
    await db.insert(schema.reminderLog).values({ userId: u.id, date: "2026-12-03", status: "sent" });
    await db.insert(schema.syncOutbox).values({ userId: u.id, kind: "progress", dedupeKey: "f1", payload: { day: 2 } });
    await expect(
      db.insert(schema.syncOutbox).values({ userId: u.id, kind: "progress", dedupeKey: "f1" }),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.pushSubscriptions).values({ userId: u.id, endpoint: "https://push.example/f", p256dh: "k", auth: "a" }),
    ).rejects.toThrow();

    await db.delete(users).where(eq(users.id, u.id));

    for (const table of [
      schema.activationTokens, schema.sessions, schema.loginAttempts, schema.actionCompletions,
      schema.liveAttendance, schema.pushSubscriptions, schema.reminderLog, schema.syncOutbox,
    ]) {
      const rows = await db.select().from(table).where(eq(table.userId, u.id));
      expect(rows).toHaveLength(0);
    }
  });
});
