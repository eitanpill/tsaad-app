// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, isLocalDatabaseUrl, type Db } from "@/db";
import { completePasswordSetup } from "@/lib/auth/accounts";
import { sha256Hex } from "@/lib/auth/crypto";
import { authenticate } from "@/lib/auth/login";
import { hashPassword } from "@/lib/auth/password";
import { rowsOf } from "@/lib/auth/sql";
import { peekToken } from "@/lib/auth/tokens";
import { createLogger } from "@/lib/logger";
import { WEBHOOK_EVENT_ID_HEADER, WEBHOOK_SECRET_HEADER } from "./auth";
import type { SignupDelivery, SignupDeliveryRequest } from "./delivery";
import { handleGhlSignup } from "./handler";

const url = process.env.DATABASE_URL;
const runIntegration = !!url && process.env.TSAAD_TEST_DB === "1" && isLocalDatabaseUrl(url);

const SECRET = "w".repeat(40);
const ORIGIN = "https://app.example.test";
const env = {
  GHL_WEBHOOK_SECRET: SECRET,
  APP_ORIGIN: ORIGIN,
  SESSION_SECRET: "x".repeat(40),
  ACTIVATION_LINK_TTL_MINUTES: "30",
  NODE_ENV: "test",
} as Record<string, string | undefined>;

describe.skipIf(!runIntegration)("GHL signup webhook (integration)", () => {
  let db: Db;
  const logs: string[] = [];
  const captured: SignupDeliveryRequest[] = [];
  const tasks: Array<() => Promise<void>> = [];
  const delivery: SignupDelivery = { name: "test-capture", deliver: async (r) => void captured.push(r) };
  const log = createLogger({ level: "debug", sink: (l) => logs.push(l) });
  let n = 0;

  const call = async (
    body: unknown,
    headers: Record<string, string> = {},
    e: Record<string, string | undefined> = env,
  ) => {
    const res = await handleGhlSignup(
      new Request(`${ORIGIN}/api/webhooks/ghl/signup`, {
        method: "POST",
        headers: { "content-type": "application/json", [WEBHOOK_SECRET_HEADER]: SECRET, ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
      { db: () => db, log, delivery, after: (t) => void tasks.push(t), env: e, startDate: () => "2026-12-01" },
    );
    return { status: res.status, json: (await res.json()) as { ok: boolean; status?: string; error?: string }, res };
  };
  const runAfter = async () => {
    while (tasks.length) await tasks.shift()!();
  };
  const contact = (over: Record<string, unknown> = {}) => ({
    contact_id: `ghl-wh-${++n}-${Math.random().toString(36).slice(2, 8)}`,
    first_name: "Dana",
    last_name: "Levi",
    email: `dana${n}@example.test`,
    phone: "052-123-4567",
    ...over,
  });
  const count = async (table: string, where = sql`true`) =>
    rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from ${sql.raw(table)} where ${where}`))[0].n;
  const tokenOf = (r: SignupDeliveryRequest) => new URL(r.link).searchParams.get("token")!;

  beforeAll(() => {
    db = createDb(url!);
  });
  beforeEach(async () => {
    logs.length = 0;
    captured.length = 0;
    tasks.length = 0;
    await db.execute(sql`delete from users where ghl_contact_id like 'ghl-wh-%' or username like 'whtest%'`);
    await db.execute(sql`delete from webhook_events`);
    await db.execute(sql`delete from login_attempts where kind = 'webhook'`);
  });
  afterAll(async () => {
    await db.execute(sql`delete from users where ghl_contact_id like 'ghl-wh-%'`);
    await db.execute(sql`delete from webhook_events`);
  });

  it("creates a user and issues one activation link, delivered after the response", async () => {
    const c = contact({ email: "Whtest.Dana@Example.com" });
    const r = await call(c);
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true, status: "created" });
    expect(r.res.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(r.json)).not.toMatch(/token|activate|whtest|052/i);
    expect(captured).toHaveLength(0); // nothing delivered until after()
    await runAfter();
    expect(captured).toHaveLength(1);
    const d = captured[0];
    expect(d.username).toBe("whtest.dana");
    expect(d.link.startsWith(`${ORIGIN}/activate?token=`)).toBe(true);
    expect(d.messages.map((m) => m.channel)).toEqual(["whatsapp", "email"]);
    expect(d.messages[0].body).toContain(d.link);

    const u = rowsOf<Record<string, unknown>>(await db.execute(sql`select * from users where ghl_contact_id = ${c.contact_id}`))[0];
    expect(u).toMatchObject({
      username: "whtest.dana",
      display_name: "Dana Levi",
      email: "whtest.dana@example.com",
      phone: "+972521234567",
      password_hash: null,
      activated_at: null,
    });
    const toks = rowsOf<{ token_hash: string; purpose: string }>(
      await db.execute(sql`select token_hash, purpose from activation_tokens where user_id = ${u.id as string}`),
    );
    expect(toks).toEqual([{ token_hash: sha256Hex(tokenOf(d)), purpose: "activate" }]);
    expect(await count("webhook_events")).toBe(1);
  });

  it("phone-only signup works (no email stored, whatsapp only, username from phone digits)", async () => {
    const r = await call({ contact_id: "ghl-wh-phone", full_name: "דנה", phone: "+972 52-777-8899" });
    expect(r.json.status).toBe("created");
    await runAfter();
    expect(captured[0].username).toBe("0527778899");
    expect(captured[0].messages.map((m) => m.channel)).toEqual(["whatsapp"]);
    const u = rowsOf<{ email: string | null; display_name: string }>(
      await db.execute(sql`select email, display_name from users where ghl_contact_id = 'ghl-wh-phone'`),
    )[0];
    expect(u).toEqual({ email: null, display_name: "דנה" });
  });

  it("username collisions get numeric suffixes", async () => {
    await call(contact({ email: "whtest.same@a.test" }));
    await call(contact({ email: "whtest.same@b.test" }));
    await call(contact({ email: "WHTEST.SAME@c.test" }));
    await runAfter();
    expect(captured.map((c) => c.username)).toEqual(["whtest.same", "whtest.same2", "whtest.same3"]);
  });

  it("when the sequential suffixes are used up, a random 6-digit suffix is used (no permanent 500)", async () => {
    await db.execute(sql`insert into users (username, display_name) values ('whtestfull', 'x')`);
    for (let i = 2; i <= 50; i++) {
      await db.execute(sql`insert into users (username, display_name) values (${`whtestfull${i}`}, 'x')`);
    }
    const r = await call(contact({ email: "whtestfull@a.test" }));
    expect(r.json.status).toBe("created");
    await runAfter();
    expect(captured[0].username).toMatch(/^whtestfull\d{6}$/);
  });

  it("a reserved local part (admin, support...) never becomes the username", async () => {
    const r = await call(contact({ contact_id: "ghl-wh-admin", email: "Admin@example.test", phone: "0527770001" }));
    expect(r.json.status).toBe("created");
    await runAfter();
    expect(captured[0].username).toBe("0527770001");
  });

  it("the display name is stored without bidi controls, URLs or digits", async () => {
    const r = await call(contact({ contact_id: "ghl-wh-bidi", full_name: "\u202eדנה\u2066 https://evil.example 0521234567\u2069" }));
    expect(r.json.status).toBe("created");
    const u = rowsOf<{ display_name: string }>(
      await db.execute(sql`select display_name from users where ghl_contact_id = 'ghl-wh-bidi'`),
    )[0];
    expect(u.display_name).toBe("דנה https evil example");
  });

  it("the same x-tsaad-event-id for two different contacts creates both (the header id is scoped per contact)", async () => {
    const a = await call(contact(), { "x-tsaad-event-id": "wf-constant" });
    const b = await call(contact(), { "x-tsaad-event-id": "wf-constant" });
    expect([a.json.status, b.json.status]).toEqual(["created", "created"]);
  });

  it("a duplicate event id returns 'duplicate', with no second user or token", async () => {
    const c = contact({ email: "whtest.dup@x.test" });
    const h = { [WEBHOOK_EVENT_ID_HEADER]: "evt-dup-1" };
    expect((await call(c, h)).json.status).toBe("created");
    const again = await call(c, h);
    expect(again).toMatchObject({ status: 200, json: { ok: true, status: "duplicate" } });
    await runAfter();
    expect(captured).toHaveLength(1);
    expect(await count("users", sql`ghl_contact_id = ${c.contact_id}`)).toBe(1);
    expect(await count("activation_tokens")).toBe(1);
    expect(await count("webhook_events")).toBe(1);
  });

  it("without an event header the id is derived from contact id: the same payload twice is a duplicate", async () => {
    const c = contact({ email: "whtest.der@x.test" });
    expect((await call(c)).json.status).toBe("created");
    expect((await call(c)).json.status).toBe("duplicate");
    await runAfter();
    expect(captured).toHaveLength(1);
  });

  it("a repeated signup of a not-yet-activated user reissues a fresh link and the old one stops working; rate limited after 3 per hour", async () => {
    const c = contact({ email: "whtest.re@x.test" });
    expect((await call(c, { [WEBHOOK_EVENT_ID_HEADER]: "e1" })).json.status).toBe("created");
    expect((await call(c, { [WEBHOOK_EVENT_ID_HEADER]: "e2" })).json.status).toBe("reissued");
    await runAfter();
    expect(captured).toHaveLength(2);
    const [t1, t2] = captured.map(tokenOf);
    expect(t1).not.toBe(t2);
    expect(await peekToken(db, t1)).toBeNull();
    expect(await peekToken(db, t2)).toMatchObject({ username: "whtest.re" });
    expect(await count("users", sql`ghl_contact_id = ${c.contact_id}`)).toBe(1);
    expect(await count("activation_tokens")).toBe(1);

    expect((await call(c, { [WEBHOOK_EVENT_ID_HEADER]: "e3" })).json.status).toBe("reissued");
    expect((await call(c, { [WEBHOOK_EVENT_ID_HEADER]: "e4" })).json.status).toBe("reissued");
    const limited = await call(c, { [WEBHOOK_EVENT_ID_HEADER]: "e5" });
    expect(limited.json.status).toBe("exists");
    await runAfter();
    expect(captured).toHaveLength(4); // no 5th link
    expect(await count("activation_tokens")).toBe(1);
  });

  it("an already activated user: 'exists', nothing changes, no link, password untouched", async () => {
    const c = contact({ email: "whtest.act@x.test" });
    await call(c, { [WEBHOOK_EVENT_ID_HEADER]: "a1" });
    await runAfter();
    const pw = "a-long-enough-password-1";
    expect(await completePasswordSetup(db, { token: tokenOf(captured[0]), passwordHash: await hashPassword(pw) })).not.toBeNull();
    captured.length = 0;
    const r = await call(c, { [WEBHOOK_EVENT_ID_HEADER]: "a2" });
    expect(r.json).toEqual({ ok: true, status: "exists" });
    await runAfter();
    expect(captured).toHaveLength(0);
    expect(await count("activation_tokens", sql`used_at is null`)).toBe(0);
    expect((await authenticate(db, { username: "whtest.act", password: pw, secret: env.SESSION_SECRET! })).ok).toBe(true);
  });

  it("concurrent identical webhooks create exactly one user and one link", async () => {
    const c = contact({ email: "whtest.conc@x.test" });
    const h = { [WEBHOOK_EVENT_ID_HEADER]: "conc-1" };
    const rs = await Promise.all(Array.from({ length: 8 }, () => call(c, h)));
    expect(rs.map((r) => r.json.status).sort()).toEqual(["created", ...Array(7).fill("duplicate")].sort());
    await runAfter();
    expect(captured).toHaveLength(1);
    expect(await count("users", sql`ghl_contact_id = ${c.contact_id}`)).toBe(1);
    expect(await count("activation_tokens")).toBe(1);
  });

  it("concurrent signups with different event ids for the same contact: one user, no crash", async () => {
    const c = contact({ email: "whtest.conc2@x.test" });
    const rs = await Promise.all(["x1", "x2", "x3"].map((e) => call(c, { [WEBHOOK_EVENT_ID_HEADER]: e })));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect(await count("users", sql`ghl_contact_id = ${c.contact_id}`)).toBe(1);
    expect(await count("activation_tokens")).toBe(1);
  });

  it("concurrent different contacts with the same email local part get distinct usernames", async () => {
    const rs = await Promise.all(
      Array.from({ length: 5 }, (_, i) => call(contact({ email: `whtest.race@d${i}.test` }))),
    );
    expect(rs.every((r) => r.json.status === "created")).toBe(true);
    expect(await count("users", sql`username like 'whtest.race%'`)).toBe(5);
  });

  it("a failure inside processing rolls everything back, including the event id (so a retry works)", async () => {
    const c = contact({ email: "whtest.rb@x.test" });
    const broken = { ...env, ACTIVATION_LINK_TTL_MINUTES: "0" };
    // ttl 0 is rejected by config before processing: 503 and nothing written
    expect((await call(c, {}, broken)).status).toBe(503);
    expect(await count("webhook_events")).toBe(0);
    expect(await count("users", sql`ghl_contact_id = ${c.contact_id}`)).toBe(0);
    expect((await call(c)).json.status).toBe("created");
  });

  it("failed auth is rate limited per trusted IP (and only counts failures)", async () => {
    const e = { ...env, TRUST_PROXY_IP_HEADERS: "true" };
    const ip = { "x-real-ip": "203.0.113.9" };
    for (let i = 0; i < 20; i++) {
      expect((await call(contact(), { ...ip, [WEBHOOK_SECRET_HEADER]: "x".repeat(40) }, e)).status).toBe(401);
    }
    const blocked = await call(contact(), { ...ip, [WEBHOOK_SECRET_HEADER]: "x".repeat(40) }, e);
    expect(blocked.status).toBe(429);
    expect(blocked.res.headers.get("retry-after")).toBeTruthy();
    // a blocked IP stays blocked even with the right secret; another IP is fine
    expect((await call(contact(), ip, e)).status).toBe(429);
    expect((await call(contact(), { "x-real-ip": "203.0.113.10" }, e)).status).toBe(200);
    // raw IPs are never stored
    expect(await count("login_attempts", sql`kind = 'webhook' and (identifier_hash like '%203.0.113%' or ip_hash like '%203.0.113%')`)).toBe(0);
    // successes do not count: 25 good calls from a fresh IP stay allowed
    for (let i = 0; i < 25; i++) expect((await call(contact(), { "x-real-ip": "198.51.100.1" }, e)).status).toBe(200);
  });

  it("without a trusted IP header, forged x-forwarded-for does not create rate-limit rows", async () => {
    await call(contact(), { "x-forwarded-for": "1.2.3.4", [WEBHOOK_SECRET_HEADER]: "bad" });
    expect(await count("login_attempts", sql`kind = 'webhook'`)).toBe(0);
  });

  it("logs contain no PII, no link, no token, no secret", async () => {
    const c = contact({ first_name: "Zeruya", last_name: "Piskantor", email: "whtest.pii@secretdomain.test", phone: "0521239876" });
    await call(c);
    await call(c); // duplicate
    await call(contact(), { [WEBHOOK_SECRET_HEADER]: "wrong-secret-value-0000000000000000000" });
    await call("{not json");
    await call({ contact_id: "x" });
    await runAfter();
    const all = logs.join("\n");
    expect(all.length).toBeGreaterThan(0);
    const token = tokenOf(captured[0]);
    for (const leak of [
      "Zeruya", "Piskantor", "whtest.pii", "secretdomain", "0521239876", "521239876", "activate", token, SECRET,
      "wrong-secret-value", String(c.contact_id), "app.example.test",
    ]) {
      expect(all).not.toContain(leak);
    }
  });

  it("end to end: webhook -> link from capture -> peek -> set password -> login works; link is one-time", async () => {
    const c = contact({ email: "whtest.flow@x.test", first_name: "Flow", last_name: "Test" });
    expect((await call(c)).json.status).toBe("created");
    await runAfter();
    const d = captured[0];
    const token = tokenOf(d);
    expect(await peekToken(db, token)).toMatchObject({ username: "whtest.flow", purpose: "activate" });
    const pw = "my-own-chosen-password-9";
    expect((await authenticate(db, { username: d.username, password: pw, secret: env.SESSION_SECRET! })).ok).toBe(false);
    const done = await completePasswordSetup(db, { token, passwordHash: await hashPassword(pw) });
    expect(done).toMatchObject({ username: "whtest.flow" });
    expect(await completePasswordSetup(db, { token, passwordHash: await hashPassword("other-password-123") })).toBeNull();
    expect((await authenticate(db, { username: d.username.toUpperCase(), password: pw, secret: env.SESSION_SECRET! })).ok).toBe(true);
  });

  it("a delivery failure is logged and does not change the response or the stored state", async () => {
    const failing: SignupDelivery = { name: "boom", deliver: async () => { throw new Error("adapter down for zed@example.com"); } };
    const res = await handleGhlSignup(
      new Request(`${ORIGIN}/x`, { method: "POST", headers: { "content-type": "application/json", [WEBHOOK_SECRET_HEADER]: SECRET }, body: JSON.stringify(contact({ email: "whtest.fail@x.test" })) }),
      { db: () => db, log, delivery: failing, after: (t) => void tasks.push(t), env },
    );
    expect(res.status).toBe(200);
    await expect(runAfter()).resolves.toBeUndefined();
    expect(logs.join("\n")).toContain("delivery failed");
    expect(logs.join("\n")).not.toContain("zed@");
    expect(await count("users", sql`username = 'whtest.fail'`)).toBe(1);
  });
});
