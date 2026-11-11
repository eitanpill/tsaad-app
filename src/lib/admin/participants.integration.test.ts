// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildConfig } from "@/config";
import { createDb, isLocalDatabaseUrl, schema, type Db } from "@/db";
import { completePasswordSetup } from "@/lib/auth/accounts";
import { authenticate } from "@/lib/auth/login";
import { hashPassword } from "@/lib/auth/password";
import { requestPasswordReset } from "@/lib/auth/forgot";
import { createSession, validateSession } from "@/lib/auth/session";
import { rowsOf } from "@/lib/auth/sql";
import { consumeToken, peekToken } from "@/lib/auth/tokens";
import { getGhlConfig } from "@/lib/ghl/config";
import { createLogger } from "@/lib/logger";
import { createDryRunPushSender, runReminders } from "@/lib/push";
import { enqueueTrackerSync } from "@/lib/sync";
import { processSignup } from "@/lib/webhooks/ghl/signup";
import { assertGuards, parseArgs, run } from "../../../scripts/admin-create-user";
import {
  createParticipant,
  deleteParticipant,
  disableParticipant,
  enableParticipant,
  issueParticipantLink,
  listParticipants,
} from "./participants";

const url = process.env.DATABASE_URL;
const runIntegration = !!url && process.env.TSAAD_TEST_DB === "1" && isLocalDatabaseUrl(url);
const SECRET = "s".repeat(32);
const log = createLogger({ level: "error", sink: () => undefined });

describe.skipIf(!runIntegration)("admin participants (integration)", () => {
  let db: Db;
  const { users } = schema;
  const count = async (table: string, where = sql`true`) =>
    rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from ${sql.raw(table)} where ${where}`))[0].n;

  /** משתמש מופעל עם סיסמה ידועה. */
  const mkActive = async (username: string, extra: Partial<typeof users.$inferInsert> = {}) =>
    (
      await db
        .insert(users)
        .values({
          username,
          displayName: `Name ${username}`,
          email: `${username}@example.test`,
          phone: "052-123-4567",
          passwordHash: await hashPassword("correct horse 12"),
          activatedAt: new Date(),
          ...extra,
        })
        .returning()
    )[0];

  beforeAll(() => {
    db = createDb(url!);
  });
  beforeEach(async () => {
    await db.delete(users);
    await db.execute(sql`delete from login_attempts`);
    await db.execute(sql`delete from webhook_events`);
  });
  afterAll(async () => {
    await db.delete(users);
  });

  it("creates a participant with a webhook-style username, normalized contact and a one-time activation link (hash only)", async () => {
    const r = await createParticipant(db, { displayName: "דנה כהן", phone: "052-123-4567", ttlMinutes: 60 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.username).toBe("0521234567");
    const u = (await db.select().from(users))[0];
    expect(u.phone).toBe("+972521234567");
    expect(u.ghlContactId).toBeNull();
    expect(u.activatedAt).toBeNull();
    const peeked = await peekToken(db, r.link.token);
    expect(peeked?.purpose).toBe("activate");
    // only the hash is stored
    expect(await count("activation_tokens", sql`token_hash = ${r.link.token}`)).toBe(0);
    // the same name again gets a numeric suffix, like the webhook
    const r2 = await createParticipant(db, { displayName: "דנה", phone: "052-123-4567", ttlMinutes: 60 });
    expect(r2.ok && r2.username).toBe("0521234567" + "2");
    // activation works with the real path
    const pw = await hashPassword("a long enough pass 1");
    expect((await completePasswordSetup(db, { token: r.link.token, passwordHash: pw }))?.username).toBe("0521234567");
  });

  it("rejects invalid input and a taken explicit username", async () => {
    expect(await createParticipant(db, { displayName: "x", ttlMinutes: 60 })).toEqual({ ok: false, error: "invalid_contact" });
    expect(await createParticipant(db, { displayName: "123", email: "a@b.co", ttlMinutes: 60 })).toEqual({ ok: false, error: "invalid_name" });
    await mkActive("pit");
    expect(await createParticipant(db, { displayName: "פיט", email: "p@example.test", username: "pit", ttlMinutes: 60 })).toEqual({ ok: false, error: "username_taken" });
    expect(await count("users")).toBe(1);
  });

  it("new link: activation for a not-yet-activated user, reset for an activated one; the previous unused link is invalidated", async () => {
    const c = await createParticipant(db, { displayName: "נועה", email: "noa@example.test", ttlMinutes: 60 });
    if (!c.ok) throw new Error("create");
    const l1 = await issueParticipantLink(db, { userId: c.userId, ttlMinutes: 60 });
    expect(l1.ok && l1.purpose).toBe("activate");
    expect(await consumeToken(db, c.link.token)).toBeNull(); // the creation link was replaced
    if (!l1.ok) return;
    await completePasswordSetup(db, { token: l1.link.token, passwordHash: await hashPassword("a long enough pass 1") });
    const l2 = await issueParticipantLink(db, { userId: c.userId, ttlMinutes: 60 });
    expect(l2.ok && l2.purpose).toBe("reset");
    if (!l2.ok) return;
    const l3 = await issueParticipantLink(db, { userId: c.userId, ttlMinutes: 60 });
    expect(l3.ok).toBe(true);
    if (!l3.ok) return;
    expect(await consumeToken(db, l2.link.token)).toBeNull();
    expect((await consumeToken(db, l3.link.token))?.purpose).toBe("reset");
    expect(await issueParticipantLink(db, { userId: "00000000-0000-0000-0000-000000000000", ttlMinutes: 60 })).toEqual({ ok: false, error: "not_found" });
  });

  it("disable: login refused like a wrong password, sessions gone, no links, no reminders, no tracker sync", async () => {
    const admin = await mkActive("admin1");
    const u = await mkActive("dana", { ghlContactId: "ghl-dana" });
    await db.insert(schema.pushSubscriptions).values({ userId: u.id, endpoint: "https://fcm.googleapis.com/fcm/send/dana", p256dh: "p", auth: "a" });
    const sess = await createSession(db, u.id);
    expect(await validateSession(db, sess.token)).not.toBeNull();
    const link = await issueParticipantLink(db, { userId: u.id, ttlMinutes: 60 });
    expect(link.ok).toBe(true);
    await enqueueTrackerSync(db, { userId: u.id, day: 1 });
    expect(await count("sync_outbox", sql`user_id = ${u.id}`)).toBe(1);

    expect(await disableParticipant(db, { userId: u.id, actorId: u.id })).toEqual({ ok: false, error: "self" });
    expect(await disableParticipant(db, { userId: u.id, actorId: admin.id })).toEqual({ ok: true });

    // login: same answer as a wrong password, even with the right one
    expect(await authenticate(db, { identifier: "dana", password: "correct horse 12", secret: SECRET })).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate(db, { identifier: "admin1", password: "correct horse 12", secret: SECRET })).toMatchObject({ ok: true });
    // sessions deleted at once, and a session can never validate
    expect(await count("sessions", sql`user_id = ${u.id}`)).toBe(0);
    expect(await validateSession(db, sess.token)).toBeNull();
    const sess2 = await createSession(db, u.id);
    expect(await validateSession(db, sess2.token)).toBeNull();
    // no new links, old ones dead, forgot-password sends nothing
    expect(await issueParticipantLink(db, { userId: u.id, ttlMinutes: 60 })).toEqual({ ok: false, error: "disabled" });
    if (link.ok) expect(await peekToken(db, link.link.token)).toBeNull();
    const sent: unknown[] = [];
    await requestPasswordReset(db, {
      identifier: "dana",
      secret: SECRET,
      ttlMinutes: 60,
      origin: "https://x.test",
      sender: { send: async (m: unknown) => void sent.push(m) } as never,
    });
    expect(sent).toHaveLength(0);
    expect(await count("activation_tokens", sql`user_id = ${u.id}`)).toBe(0);
    // tracker sync: pending rows are dead, nothing new is queued
    expect(await count("sync_outbox", sql`user_id = ${u.id} and status = 'dead'`)).toBe(1);
    expect(await enqueueTrackerSync(db, { userId: u.id, day: 2 })).toBe(false);

    // reminders skip the disabled user (push and GHL channel), and still serve the active one
    const act = await mkActive("noa", { ghlContactId: "ghl-noa" });
    await db.insert(schema.pushSubscriptions).values({ userId: act.id, endpoint: "https://fcm.googleapis.com/fcm/send/noa", p256dh: "p", auth: "a" });
    const config = buildConfig({ START_DATE: "2026-12-01", GHL_REMINDER_MODE: "dry" });
    const res = await runReminders({
      db,
      config,
      sender: createDryRunPushSender(),
      now: new Date("2026-12-01T05:30:00Z"),
      log,
      ghlConfig: getGhlConfig(config.env),
    });
    expect(res.claimed).toBe(1);
    expect(res.ghl?.claimed).toBe(1);
    expect(await count("reminder_log", sql`user_id = ${u.id}`)).toBe(0);
    expect(await count("reminder_log", sql`user_id = ${act.id}`)).toBe(2);
  });

  it("a disabled user's activation or reset link cannot be used", async () => {
    const admin = await mkActive("admin1");
    const c = await createParticipant(db, { displayName: "נועה", email: "noa@example.test", ttlMinutes: 60 });
    if (!c.ok) throw new Error("create");
    await disableParticipant(db, { userId: c.userId, actorId: admin.id });
    expect(await completePasswordSetup(db, { token: c.link.token, passwordHash: "h" })).toBeNull();
  });

  it("enable restores login", async () => {
    const admin = await mkActive("admin1");
    const u = await mkActive("dana");
    await disableParticipant(db, { userId: u.id, actorId: admin.id });
    expect(await enableParticipant(db, { userId: u.id })).toEqual({ ok: true });
    expect(await authenticate(db, { identifier: "dana", password: "correct horse 12", secret: SECRET })).toMatchObject({ ok: true });
    expect(await enableParticipant(db, { userId: "00000000-0000-0000-0000-000000000000" })).toEqual({ ok: false, error: "not_found" });
  });

  it("delete: cascades all personal data, refuses to delete yourself", async () => {
    const admin = await mkActive("admin1");
    const u = await mkActive("dana", { ghlContactId: "g1" });
    await createSession(db, u.id);
    await db.insert(schema.actionCompletions).values({ userId: u.id, day: 1, action: "habit" });
    await db.insert(schema.pushSubscriptions).values({ userId: u.id, endpoint: "https://fcm.googleapis.com/fcm/send/d", p256dh: "p", auth: "a" });
    await issueParticipantLink(db, { userId: u.id, ttlMinutes: 60 });
    expect(await deleteParticipant(db, { userId: admin.id, actorId: admin.id })).toEqual({ ok: false, error: "self" });
    expect(await deleteParticipant(db, { userId: u.id, actorId: admin.id })).toEqual({ ok: true, hadGhlContact: true });
    for (const t of ["sessions", "action_completions", "push_subscriptions", "activation_tokens"]) {
      expect(await count(t, sql`user_id = ${u.id}`)).toBe(0);
    }
    expect(await count("users", sql`id = ${u.id}`)).toBe(0);
    expect(await deleteParticipant(db, { userId: u.id, actorId: admin.id })).toEqual({ ok: false, error: "not_found" });
  });

  it("a GHL signup for an existing disabled contact does not re-enable, reissue a link or change anything", async () => {
    const admin = await mkActive("admin1");
    const notActivated = (
      await db.insert(users).values({ username: "newbie", displayName: "N", email: "n@example.test", ghlContactId: "c-new" }).returning()
    )[0];
    const activated = await mkActive("dana", { ghlContactId: "c-act" });
    await disableParticipant(db, { userId: notActivated.id, actorId: admin.id });
    await disableParticipant(db, { userId: activated.id, actorId: admin.id });
    for (const [i, cid] of ["c-new", "c-act"].entries()) {
      const out = await processSignup(db, {
        eventId: `ev-${i}`,
        payload: { ghlContactId: cid, displayName: "Z", email: "z@example.test", phoneE164: null, marker: null },
        ttlMinutes: 60,
        rateLimitSecret: SECRET,
        log,
      });
      expect(out).toEqual({ status: "exists" });
    }
    expect(await count("users", sql`disabled_at is not null`)).toBe(2);
    expect(await count("activation_tokens")).toBe(0);
  });

  it("lists with search, paging and last activity", async () => {
    const a = await mkActive("dana");
    await mkActive("noa");
    await db.insert(schema.actionCompletions).values({ userId: a.id, day: 1, action: "habit" });
    const all = await listParticipants(db, {});
    expect(all.total).toBe(2);
    const dana = all.rows.find((r) => r.username === "dana")!;
    expect(dana.activated).toBe(true);
    expect(dana.disabled).toBe(false);
    expect(dana.lastActivity).toBeInstanceOf(Date);
    expect(all.rows.find((r) => r.username === "noa")!.lastActivity).toBeNull();
    expect((await listParticipants(db, { q: "DAN" })).rows.map((r) => r.username)).toEqual(["dana"]);
    expect((await listParticipants(db, { q: "%" })).total).toBe(0); // wildcard is escaped
    expect((await listParticipants(db, { pageSize: 1, page: 2 })).rows).toHaveLength(1);
    expect((await listParticipants(db, { pageSize: 1, page: 99 })).page).toBe(2); // clamped
  });

  describe("scripts/admin-create-user run()", () => {
    const g = { origin: "https://app.example.test", ttlMinutes: 4320 };
    it("creates, then refuses a duplicate, then --new-link issues activation, then reset", async () => {
      const args = parseArgs(["--username", "pit", "--name", "פיט", "--email", "pit@example.test", "--phone", "050-123-4567", "--confirm-production"]);
      const r = await run(db, args, g);
      expect(r.kind).toBe("created");
      const token = new URL(r.link).searchParams.get("token")!;
      expect(r.link.startsWith("https://app.example.test/activate?token=")).toBe(true);
      expect((await peekToken(db, token))?.username).toBe("pit");
      await expect(run(db, args, g)).rejects.toThrow(/already exists.*--new-link/);

      const again = await run(db, parseArgs(["--username", "pit", "--new-link", "--confirm-production"]), g);
      expect(again.kind).toBe("activate");
      expect(await peekToken(db, token)).toBeNull();
      await completePasswordSetup(db, { token: new URL(again.link).searchParams.get("token")!, passwordHash: await hashPassword("a long enough pass 1") });
      const reset = await run(db, parseArgs(["--username", "pit", "--new-link", "--confirm-production"]), g);
      expect(reset.kind).toBe("reset");
      await expect(run(db, parseArgs(["--username", "nobody", "--new-link", "--confirm-production"]), g)).rejects.toThrow(/no account/);
      // TTL comes from the guard value
      const exp = rowsOf<{ m: number }>(await db.execute(sql`select extract(epoch from (expires_at - now()))/60 as m from activation_tokens limit 1`))[0].m;
      expect(Math.round(exp)).toBeGreaterThan(4300);
      expect(assertGuards({ DATABASE_URL: "postgres://u:p@h/db", APP_ORIGIN: "https://x.test" }, { confirmProduction: true }).ttlMinutes).toBe(4320);
    });
  });
});
