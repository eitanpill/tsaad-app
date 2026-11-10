// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, isLocalDatabaseUrl, schema, type Db } from "@/db";
import { rowsOf } from "@/lib/auth/sql";
import { hashPassword } from "@/lib/auth/password";
import { deleteAccountCore } from "./delete";

const url = process.env.DATABASE_URL;
const runIntegration = !!url && process.env.TSAAD_TEST_DB === "1" && isLocalDatabaseUrl(url);
const SECRET = "x".repeat(40);

describe.skipIf(!runIntegration)("deleteAccountCore (integration)", () => {
  let db: Db;
  let n = 0;
  beforeAll(() => {
    db = createDb(url!);
  });
  afterAll(async () => {
    await db.execute(sql`delete from users where username like 'del%'`);
    await db.execute(sql`delete from login_attempts where kind = 'account'`);
  });

  const mk = async (password = "right-pass-1") => {
    const i = ++n;
    const [u] = await db
      .insert(schema.users)
      .values({ username: `del${i}`, displayName: "x", email: `del${i}@example.test`, ghlContactId: `ghl-del-${i}`, passwordHash: await hashPassword(password) })
      .returning();
    const exp = new Date(Date.now() + 60_000);
    await db.insert(schema.activationTokens).values({ userId: u.id, tokenHash: `a${i}`, purpose: "reset", expiresAt: exp });
    await db.insert(schema.sessions).values({ userId: u.id, tokenHash: `s${i}`, expiresAt: exp });
    await db.insert(schema.actionCompletions).values({ userId: u.id, day: 2, action: "habit" });
    await db.insert(schema.pushSubscriptions).values({ userId: u.id, endpoint: `https://fcm.googleapis.com/${i}`, p256dh: "k", auth: "a" });
    await db.insert(schema.reminderLog).values({ userId: u.id, date: "2026-12-03", status: "sent" });
    await db.insert(schema.syncOutbox).values({ userId: u.id, kind: "tracker", dedupeKey: `d${i}`, payload: {} });
    return u.id;
  };
  const count = async (table: string, userId: string) =>
    rowsOf<{ n: number }>(await db.execute(sql.raw(`select count(*)::int as n from ${table} where user_id = '${userId}'`)))[0].n;
  const TABLES = ["activation_tokens", "sessions", "action_completions", "push_subscriptions", "reminder_log", "sync_outbox"];

  it("a wrong password deletes nothing", async () => {
    const id = await mk();
    const r = await deleteAccountCore(db, { userId: id, password: "wrong-pass-1", secret: SECRET });
    expect(r).toEqual({ ok: false, reason: "invalid_password" });
    expect(rowsOf(await db.execute(sql`select 1 from users where id = ${id}`))).toHaveLength(1);
    expect(await count("sessions", id)).toBe(1);
  });

  it("the right password deletes the user and every personal table cascades (sessions, tokens, push, reminders, outbox)", async () => {
    const id = await mk();
    for (const t of TABLES) expect(await count(t, id)).toBeGreaterThan(0);
    const r = await deleteAccountCore(db, { userId: id, password: "right-pass-1", secret: SECRET });
    expect(r).toEqual({ ok: true, ghlContactId: expect.stringMatching(/^ghl-del-/) });
    expect(rowsOf(await db.execute(sql`select 1 from users where id = ${id}`))).toHaveLength(0);
    for (const t of TABLES) expect(await count(t, id)).toBe(0);
  });

  it("only the account of the given user id is touched", async () => {
    const a = await mk();
    const b = await mk();
    await deleteAccountCore(db, { userId: a, password: "right-pass-1", secret: SECRET });
    expect(rowsOf(await db.execute(sql`select 1 from users where id = ${b}`))).toHaveLength(1);
    expect(await count("push_subscriptions", b)).toBe(1);
  });

  it("an unknown user id and an empty password fail without deleting", async () => {
    const id = await mk();
    expect(await deleteAccountCore(db, { userId: id, password: "", secret: SECRET })).toMatchObject({ ok: false, reason: "invalid_password" });
    expect(await deleteAccountCore(db, { userId: "00000000-0000-0000-0000-000000000000", password: "x", secret: SECRET })).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("is rate limited per user: after 5 attempts in the window, even the right password is refused", async () => {
    const id = await mk();
    for (let i = 0; i < 5; i++) {
      expect(await deleteAccountCore(db, { userId: id, password: "nope-nope-1", secret: SECRET })).toMatchObject({ reason: "invalid_password" });
    }
    const r = await deleteAccountCore(db, { userId: id, password: "right-pass-1", secret: SECRET });
    expect(r).toMatchObject({ ok: false, reason: "rate_limited" });
    expect(rowsOf(await db.execute(sql`select 1 from users where id = ${id}`))).toHaveLength(1);
  });
});
