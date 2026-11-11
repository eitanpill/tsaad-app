// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, isLocalDatabaseUrl, schema, type Db } from "@/db";
import type { MessageSender, OutgoingMessage } from "@/lib/messaging/sender";
import { completePasswordSetup } from "./accounts";
import { sha256Hex } from "./crypto";
import { requestPasswordReset } from "./forgot";
import { authenticate } from "./login";
import { hashPassword } from "./password";
import { clearAttempts, rateLimitKeys, registerAttempt } from "./rate-limit";
import {
  createSession,
  deleteAllSessions,
  deleteSession,
  purgeExpired,
  rotateSession,
  validateSession,
} from "./session";
import { rowsOf } from "./sql";
import { consumeToken, issueToken, peekToken } from "./tokens";

const url = process.env.DATABASE_URL;
const runIntegration = !!url && process.env.TSAAD_TEST_DB === "1" && isLocalDatabaseUrl(url);
const SECRET = "s".repeat(32);

describe.skipIf(!runIntegration)("auth (integration)", () => {
  let db: Db;
  const { users } = schema;

  const count = async (table: string, where = sql`true`) =>
    rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from ${sql.raw(table)} where ${where}`))[0].n;

  const mkUser = async (
    username: string,
    opts: { password?: string; email?: string; phone?: string } = {},
  ) =>
    (
      await db
        .insert(users)
        .values({
          username,
          displayName: `Name ${username}`,
          email: opts.email ?? `${username}@example.test`,
          phone: opts.phone ?? null,
          passwordHash: opts.password ? await hashPassword(opts.password) : null,
          activatedAt: opts.password ? new Date() : null,
        })
        .returning()
    )[0];

  beforeAll(() => {
    db = createDb(url!);
  });
  beforeEach(async () => {
    await db.delete(users);
    await db.execute(sql`delete from login_attempts`);
  });
  afterAll(async () => {
    await db.delete(users);
    await db.execute(sql`delete from login_attempts`);
    await (db as unknown as { $client: { end(): Promise<void> } }).$client.end();
  });

  describe("tokens", () => {
    it("stores only a sha256 hash, and the token works once", async () => {
      const u = await mkUser("tok1");
      const { token } = await issueToken(db, { userId: u.id, purpose: "activate", ttlMinutes: 30 });
      const rows = rowsOf<{ token_hash: string }>(await db.execute(sql`select token_hash from activation_tokens`));
      expect(rows[0].token_hash).toBe(sha256Hex(token));
      expect(rows[0].token_hash).not.toContain(token);

      expect(await peekToken(db, token)).toMatchObject({ userId: u.id, username: "tok1", purpose: "activate" });
      // peek does not burn the link
      expect(await peekToken(db, token)).not.toBeNull();

      expect(await consumeToken(db, token)).toMatchObject({ userId: u.id, purpose: "activate" });
      expect(await consumeToken(db, token)).toBeNull();
      expect(await peekToken(db, token)).toBeNull();
    });

    it("rejects an expired token, an unknown token and a wrong purpose", async () => {
      const u = await mkUser("tok2");
      const { token } = await issueToken(db, { userId: u.id, purpose: "reset", ttlMinutes: 30 });
      expect(await consumeToken(db, token, ["activate"])).toBeNull();
      await db.execute(sql`update activation_tokens set expires_at = now() - interval '1 second'`);
      expect(await peekToken(db, token)).toBeNull();
      expect(await consumeToken(db, token)).toBeNull();
      expect(await consumeToken(db, "nope")).toBeNull();
      expect(await consumeToken(db, "")).toBeNull();
    });

    it("sets the expiry from the TTL on the database clock", async () => {
      const u = await mkUser("tok3");
      const { expiresAt } = await issueToken(db, { userId: u.id, purpose: "activate", ttlMinutes: 10 });
      const diff = expiresAt.getTime() - Date.now();
      expect(diff).toBeGreaterThan(9 * 60_000);
      expect(diff).toBeLessThan(11 * 60_000);
      await expect(issueToken(db, { userId: u.id, purpose: "activate", ttlMinutes: 0 })).rejects.toThrow();
    });

    it("two concurrent consumes: exactly one wins", async () => {
      const u = await mkUser("race");
      const { token } = await issueToken(db, { userId: u.id, purpose: "activate", ttlMinutes: 30 });
      const results = await Promise.all(Array.from({ length: 8 }, () => consumeToken(db, token)));
      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it("a newer token of the same purpose invalidates older unused ones", async () => {
      const u = await mkUser("reissue", { password: "pass-1234" });
      const a = await issueToken(db, { userId: u.id, purpose: "reset", ttlMinutes: 30 });
      const other = await issueToken(db, { userId: u.id, purpose: "activate", ttlMinutes: 30 });
      const b = await issueToken(db, { userId: u.id, purpose: "reset", ttlMinutes: 30 });
      expect(await consumeToken(db, a.token)).toBeNull();
      expect(await peekToken(db, other.token)).not.toBeNull(); // other purpose untouched
      expect(await consumeToken(db, b.token)).not.toBeNull();
    });

    it("concurrent issues leave exactly one live token", async () => {
      const u = await mkUser("conc-issue");
      await Promise.all(
        Array.from({ length: 5 }, () => issueToken(db, { userId: u.id, purpose: "reset", ttlMinutes: 30 })),
      );
      expect(await count("activation_tokens", sql`used_at is null`)).toBe(1);
    });
  });

  describe("password setup", () => {
    it("sets the password, activates, kills every session and other links, and works once", async () => {
      const u = await mkUser("setup", { password: "old-pass-1" });
      const s1 = await createSession(db, u.id);
      await createSession(db, u.id);
      const { token } = await issueToken(db, { userId: u.id, purpose: "reset", ttlMinutes: 30 });
      const other = await issueToken(db, { userId: u.id, purpose: "activate", ttlMinutes: 30 });

      const hash = await hashPassword("new-pass-2");
      expect(await completePasswordSetup(db, { token, passwordHash: hash })).toMatchObject({ userId: u.id });
      expect(await completePasswordSetup(db, { token, passwordHash: hash })).toBeNull();

      expect(await validateSession(db, s1.token)).toBeNull();
      expect(await count("sessions")).toBe(0);
      expect(await peekToken(db, other.token)).toBeNull();
      expect((await authenticate(db, { username: "setup", password: "new-pass-2", secret: SECRET })).ok).toBe(true);
      expect((await authenticate(db, { username: "setup", password: "old-pass-1", secret: SECRET })).ok).toBe(false);
    });

    it("first activation sets activated_at", async () => {
      const u = await mkUser("first");
      const { token } = await issueToken(db, { userId: u.id, purpose: "activate", ttlMinutes: 30 });
      await completePasswordSetup(db, { token, passwordHash: await hashPassword("first-pass-1") });
      const [row] = await db.select().from(users);
      expect(row.activatedAt).not.toBeNull();
      expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it("concurrent submissions of one link: exactly one succeeds", async () => {
      const u = await mkUser("setup-race");
      const { token } = await issueToken(db, { userId: u.id, purpose: "activate", ttlMinutes: 30 });
      const h = await hashPassword("race-pass-1");
      const res = await Promise.all(
        Array.from({ length: 5 }, () => completePasswordSetup(db, { token, passwordHash: h })),
      );
      expect(res.filter(Boolean)).toHaveLength(1);
    });
  });

  describe("sessions", () => {
    it("stores only a hash; validates; logout deletes the row", async () => {
      const u = await mkUser("sess1", { password: "pass-12345" });
      const { token, expiresAt } = await createSession(db, u.id);
      const [row] = rowsOf<{ token_hash: string }>(await db.execute(sql`select token_hash from sessions`));
      expect(row.token_hash).toBe(sha256Hex(token));
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);

      expect(await validateSession(db, token)).toMatchObject({ userId: u.id, username: "sess1" });
      await deleteSession(db, token);
      expect(await validateSession(db, token)).toBeNull();
      expect(await count("sessions")).toBe(0);
    });

    it("expires at the absolute limit and after idle time", async () => {
      const u = await mkUser("sess2", { password: "pass-12345" });
      const abs = await createSession(db, u.id);
      await db.execute(sql`update sessions set expires_at = now() - interval '1 second'`);
      expect(await validateSession(db, abs.token)).toBeNull();

      await db.execute(sql`delete from sessions`);
      const idle = await createSession(db, u.id);
      await db.execute(sql`update sessions set last_seen_at = now() - interval '15 days'`);
      expect(await validateSession(db, idle.token)).toBeNull();

      await db.execute(sql`delete from sessions`);
      const ok = await createSession(db, u.id);
      await db.execute(sql`update sessions set last_seen_at = now() - interval '13 days'`);
      expect(await validateSession(db, ok.token)).not.toBeNull();
    });

    it("touches last_seen_at only when it is stale", async () => {
      const u = await mkUser("sess3", { password: "pass-12345" });
      const { token } = await createSession(db, u.id);
      const read = async () =>
        rowsOf<{ t: string }>(await db.execute(sql`select last_seen_at::text as t from sessions`))[0].t;
      const before = await read();
      await validateSession(db, token);
      expect(await read()).toBe(before);
      await db.execute(sql`update sessions set last_seen_at = now() - interval '1 hour'`);
      const stale = await read();
      await validateSession(db, token);
      expect(await read()).not.toBe(stale);
    });

    it("rejects a session whose user has no password", async () => {
      const u = await mkUser("sess4");
      const { token } = await createSession(db, u.id);
      expect(await validateSession(db, token)).toBeNull();
    });

    it("rotation on login replaces the previous session", async () => {
      const u = await mkUser("sess5", { password: "pass-12345" });
      const first = await createSession(db, u.id);
      const second = await rotateSession(db, u.id, first.token);
      expect(second.token).not.toBe(first.token);
      expect(await validateSession(db, first.token)).toBeNull();
      expect(await validateSession(db, second.token)).not.toBeNull();
      expect(await count("sessions")).toBe(1);
    });

    it("deleteAllSessions and purgeExpired", async () => {
      const u = await mkUser("sess6", { password: "pass-12345" });
      await createSession(db, u.id);
      await createSession(db, u.id);
      await deleteAllSessions(db, u.id);
      expect(await count("sessions")).toBe(0);

      await createSession(db, u.id);
      await createSession(db, u.id);
      await db.execute(sql`update sessions set expires_at = now() - interval '1 minute' where id = (select id from sessions limit 1)`);
      await db.execute(sql`insert into login_attempts (identifier_hash, attempted_at) values ('x', now() - interval '2 days')`);
      await purgeExpired(db);
      expect(await count("sessions")).toBe(1);
      expect(await count("login_attempts")).toBe(0);
    });
  });

  describe("rate limit", () => {
    const limits = { windowSeconds: 600, perIdentifier: 3, perIp: 5 };

    it("blocks the attempt after the per-identifier limit, and blocked attempts are not recorded", async () => {
      const keys = rateLimitKeys(SECRET, "victim", "1.1.1.1");
      for (let i = 0; i < 3; i++) expect((await registerAttempt(db, "login", keys, limits)).allowed).toBe(true);
      const blocked = await registerAttempt(db, "login", keys, limits);
      expect(blocked).toMatchObject({ allowed: false });
      expect((blocked as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(0);
      expect((blocked as { retryAfterSeconds: number }).retryAfterSeconds).toBeLessThanOrEqual(600);
      await registerAttempt(db, "login", keys, limits);
      expect(await count("login_attempts")).toBe(3);
    });

    it("limits per IP across different identifiers", async () => {
      for (let i = 0; i < 5; i++) {
        const r = await registerAttempt(db, "login", rateLimitKeys(SECRET, `user${i}`, "2.2.2.2"), limits);
        expect(r.allowed).toBe(true);
      }
      expect((await registerAttempt(db, "login", rateLimitKeys(SECRET, "another", "2.2.2.2"), limits)).allowed).toBe(false);
      expect((await registerAttempt(db, "login", rateLimitKeys(SECRET, "another", "3.3.3.3"), limits)).allowed).toBe(true);
    });

    it("keeps login and forgot counters separate, and ignores attempts outside the window", async () => {
      const keys = rateLimitKeys(SECRET, "x", "4.4.4.4");
      for (let i = 0; i < 3; i++) await registerAttempt(db, "login", keys, limits);
      expect((await registerAttempt(db, "forgot", keys, limits)).allowed).toBe(true);
      await db.execute(sql`update login_attempts set attempted_at = now() - interval '11 minutes'`);
      expect((await registerAttempt(db, "login", keys, limits)).allowed).toBe(true);
    });

    it("stores HMACs, never the raw identifier or IP", async () => {
      await registerAttempt(db, "login", rateLimitKeys(SECRET, "noa.k", "5.5.5.5"), limits);
      const [r] = rowsOf<{ identifier_hash: string; ip_hash: string }>(
        await db.execute(sql`select identifier_hash, ip_hash from login_attempts`),
      );
      expect(r.identifier_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(r.ip_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(r.identifier_hash).not.toBe(sha256Hex("noa.k"));
    });

    it("a missing IP still limits by identifier; clearAttempts resets", async () => {
      const keys = rateLimitKeys(SECRET, "noip", null);
      for (let i = 0; i < 3; i++) await registerAttempt(db, "login", keys, limits);
      expect((await registerAttempt(db, "login", keys, limits)).allowed).toBe(false);
      await clearAttempts(db, "login", keys);
      expect((await registerAttempt(db, "login", keys, limits)).allowed).toBe(true);
    });

    it("concurrent attempts cannot exceed the limit", async () => {
      const keys = rateLimitKeys(SECRET, "burst", "6.6.6.6");
      const results = await Promise.all(
        Array.from({ length: 12 }, () => registerAttempt(db, "login", keys, limits)),
      );
      expect(results.filter((r) => r.allowed).length).toBeLessThanOrEqual(3);
      expect(results.filter((r) => r.allowed).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("authenticate", () => {
    it("logs in with the right password only; every failure is the same", async () => {
      await mkUser("login1", { password: "right-pass-1" });
      await mkUser("pending"); // never activated
      const a = (u: string, p: string) => authenticate(db, { username: u, password: p, secret: SECRET, ip: "7.7.7.7" });
      expect(await a("login1", "right-pass-1")).toMatchObject({ ok: true });
      expect(await a(" LOGIN1 ", "right-pass-1")).toMatchObject({ ok: true });
      const wrong = await a("login1", "wrong-pass-1");
      const missing = await a("nobody", "wrong-pass-1");
      const pending = await a("pending", "wrong-pass-1");
      const empty = await a("", "x");
      const huge = await a("login1", "x".repeat(5000));
      for (const r of [wrong, missing, pending, empty, huge]) expect(r).toEqual({ ok: false, reason: "invalid" });
    });

    it("locks after repeated failures even for the right password, and success clears the count", async () => {
      await mkUser("login2", { password: "right-pass-1" });
      const a = (p: string) => authenticate(db, { username: "login2", password: p, secret: SECRET });
      for (let i = 0; i < 4; i++) await a("bad");
      expect(await a("right-pass-1")).toMatchObject({ ok: true }); // 5th attempt, still allowed, clears
      for (let i = 0; i < 5; i++) await a("bad");
      expect(await a("right-pass-1")).toMatchObject({ ok: false, reason: "rate_limited" });
    });
  });

  describe("lockout and the reset link", () => {
    it("while a username is locked for login, the reset link still goes out and sets a password that works", async () => {
      await mkUser("locked1", { password: "right-pass-1", phone: "050-123-4567" });
      const a = (p: string) => authenticate(db, { username: "locked1", password: p, secret: SECRET });
      for (let i = 0; i < 5; i++) await a("bad");
      expect(await a("right-pass-1")).toMatchObject({ ok: false, reason: "rate_limited" });

      const sent: OutgoingMessage[] = [];
      const sender: MessageSender = { async send(m) { sent.push(m); } };
      const r = await requestPasswordReset(db, { identifier: "locked1", secret: SECRET, ip: "5.5.5.5", ttlMinutes: 30, sender, origin: "https://app.example.com" });
      expect(r).toEqual({ status: "ok" });
      expect(sent.length).toBeGreaterThan(0);
      expect(await count("activation_tokens", sql`used_at is null`)).toBe(1);

      const [u] = await db.select().from(users);
      const { token } = await issueToken(db, { userId: u.id, purpose: "reset", ttlMinutes: 30 });
      expect(await completePasswordSetup(db, { token, passwordHash: await hashPassword("new-pass-2") })).toMatchObject({ userId: u.id });
      // what activateAction does next: the link proved ownership, so the lockout is lifted
      await clearAttempts(db, "login", rateLimitKeys(SECRET, "locked1", null));
      expect(await a("new-pass-2")).toMatchObject({ ok: true });
    });
  });

  describe("forgot password", () => {
    const recorder = () => {
      const sent: OutgoingMessage[] = [];
      const sender: MessageSender = { async send(m) { sent.push(m); } };
      return { sent, sender };
    };
    const run = (identifier: string, sender: MessageSender, ip = "8.8.8.8") =>
      requestPasswordReset(db, { identifier, secret: SECRET, ip, ttlMinutes: 30, sender, origin: "https://app.example.com" });

    it("returns the same result for an existing and a non-existing account", async () => {
      await mkUser("exists", { password: "pass-12345", phone: "050-123-4567" });
      const r = recorder();
      const a = await run("exists", r.sender);
      const b = await run("no-such-user", r.sender, "9.9.9.9");
      const c = await run("nobody@example.test", r.sender, "9.9.9.10");
      expect(a).toEqual({ status: "ok" });
      expect(b).toEqual(a);
      expect(c).toEqual(a);
      // only the real account got messages: email + whatsapp
      expect(r.sent.map((m) => m.channel).sort()).toEqual(["email", "whatsapp"]);
      expect(await count("activation_tokens")).toBe(1);
    });

    it("matches by username, email (any case) and phone format, and sends to the stored contact", async () => {
      const u = await mkUser("finder", { password: "pass-12345", email: "Finder@Example.test", phone: "050-123-4567" });
      for (const [i, ident] of ["finder", "FINDER@example.TEST", "0501234567", "+972 50-123-4567"].entries()) {
        const r = recorder();
        await run(ident, r.sender, `10.0.0.${i}`);
        expect(r.sent.length, ident).toBe(2);
        expect(r.sent.every((m) => m.userId === u.id && m.kind === "reset")).toBe(true);
        expect(r.sent[0].link).toMatch(/^https:\/\/app\.example\.com\/activate\?token=[A-Za-z0-9_-]{43}$/);
      }
    });

    it("an unactivated account gets an activation link; a user without a phone gets email only", async () => {
      await mkUser("fresh");
      const r = recorder();
      await run("fresh", r.sender);
      expect(r.sent.map((m) => [m.kind, m.channel])).toEqual([["activation", "email"]]);
    });

    it("issuing again invalidates the previous link", async () => {
      await mkUser("twice", { password: "pass-12345" });
      const r = recorder();
      await run("twice", r.sender);
      await run("twice", r.sender);
      const tokens = r.sent.map((m) => new URL(m.link).searchParams.get("token")!);
      expect(await peekToken(db, tokens[0])).toBeNull();
      expect(await peekToken(db, tokens[1])).not.toBeNull();
    });

    it("rate-limits by identifier whether or not the account exists", async () => {
      await mkUser("limited", { password: "pass-12345" });
      const r = recorder();
      const outcome = async (ident: string) => {
        const res = [];
        for (let i = 0; i < 4; i++) res.push((await run(ident, r.sender, `11.0.0.${i}`)).status);
        return res;
      };
      expect(await outcome("limited")).toEqual(["ok", "ok", "ok", "rate_limited"]);
      expect(await outcome("not-a-user")).toEqual(["ok", "ok", "ok", "rate_limited"]);
    });

    it("caps links per account across differently written identifiers (no message flooding)", async () => {
      await mkUser("flooded", { password: "pass-12345", phone: "050-765-4321" });
      const r = recorder();
      // each spelling of the phone is a distinct identifier, so only the per-account cap stops this
      const spellings = ["0507654321", "050-7654321", "050 765 4321", "+972507654321", "972-50-765-4321", "(050) 765-4321", "050.765.4321"];
      for (const [i, ident] of spellings.entries()) {
        expect((await run(ident, r.sender, `13.0.0.${i}`)).status).toBe("ok");
      }
      const emails = r.sent.filter((m) => m.channel === "email");
      expect(emails).toHaveLength(5);
    });

    it("with defer, delivery runs only when the deferred task runs (after the response)", async () => {
      await mkUser("deferred", { password: "pass-12345" });
      const r = recorder();
      let task: (() => Promise<void>) | undefined;
      const res = await requestPasswordReset(db, {
        identifier: "deferred",
        secret: SECRET,
        ip: "14.0.0.1",
        ttlMinutes: 30,
        sender: r.sender,
        origin: "https://app.example.com",
        defer: (t) => {
          task = t;
        },
      });
      expect(res).toEqual({ status: "ok" });
      expect(r.sent).toHaveLength(0);
      expect(await count("activation_tokens")).toBe(0);
      await task!();
      expect(r.sent).toHaveLength(1);
      expect(await count("activation_tokens")).toBe(1);
    });

    it("a failing sender does not change the answer", async () => {
      await mkUser("broken", { password: "pass-12345" });
      const sender: MessageSender = { async send() { throw new Error("boom"); } };
      expect(await run("broken", sender)).toEqual({ status: "ok" });
    });

    it("a hostile identifier is just a non-match", async () => {
      const r = recorder();
      expect(await run("' or 1=1 --", r.sender)).toEqual({ status: "ok" });
      expect(await run("%", r.sender, "12.0.0.1")).toEqual({ status: "ok" });
      expect(r.sent).toHaveLength(0);
    });
  });
});
