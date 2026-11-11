// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildConfig } from "@/config";
import { createDb, isLocalDatabaseUrl, schema, type Db } from "@/db";
import { rowsOf } from "@/lib/auth/sql";
import { sha256Hex } from "@/lib/auth/crypto";
import { createLogger } from "@/lib/logger";
import { createDryRunPushSender } from "@/lib/push/sender";
import { runReminders } from "@/lib/push/reminders";
import { claimDue, enqueueTrackerSync } from "@/lib/sync/outbox";
import { runSyncWorker } from "@/lib/sync/worker";
import { requestPasswordReset } from "@/lib/auth/forgot";
import { issueToken } from "@/lib/auth/tokens";
import type { GhlClient } from "./client";
import { getGhlConfig } from "./config";
import { createLinkDelivery } from "./link-delivery";
import { enqueueLink, runGhlOutbox } from "./outbox";
import { getWhatsappReminderPref, setWhatsappReminderPref } from "./preferences";
import { queueGhlReminders } from "./reminders";

const url = process.env.DATABASE_URL;
const runIntegration = !!url && process.env.TSAAD_TEST_DB === "1" && isLocalDatabaseUrl(url);
const TOKEN = "pit-0123456789abcdef0123456789abcdef";
const ORIGIN = "https://app.example.test";
const ghlEnv = (extra: Record<string, string> = {}) => ({ GHL_API_TOKEN: TOKEN, GHL_LOCATION_ID: "loc-123456", ...extra });

describe.skipIf(!runIntegration)("ghl (integration)", () => {
  let db: Db;
  const lines: string[] = [];
  const log = createLogger({ level: "debug", sink: (l) => lines.push(l) });
  const count = async (table: string, where = sql`true`) =>
    rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from ${sql.raw(table)} where ${where}`))[0].n;
  let n = 0;
  const mkUser = async (o: { contact?: string | null; activated?: boolean; sub?: boolean } = {}) => {
    const i = ++n;
    const [u] = await db
      .insert(schema.users)
      .values({
        username: `ghlt${i}`, displayName: "x", email: `ghlt${i}@example.test`, phone: "+972521234567",
        ghlContactId: o.contact === undefined ? `contact${i}abcdef` : o.contact,
        passwordHash: o.activated === false ? null : "h",
        activatedAt: o.activated === false ? null : new Date(),
      })
      .returning();
    if (o.sub) await db.insert(schema.pushSubscriptions).values({ userId: u.id, endpoint: `https://fcm.googleapis.com/fcm/send/g${i}`, p256dh: "p", auth: "a" });
    return u;
  };
  const okClient = () => {
    const calls: string[] = [];
    const bodies: unknown[] = [];
    const client: GhlClient = {
      updateCustomFields: vi.fn(async (c, f) => (calls.push(`field ${c}`), bodies.push(f), { ok: true as const })),
      addTags: vi.fn(async (c, t) => (calls.push(`add ${c} ${t.join()}`), { ok: true as const })),
      removeTags: vi.fn(async (c, t) => (calls.push(`remove ${c} ${t.join()}`), { ok: true as const })),
    };
    return { client, calls, bodies };
  };
  const live = getGhlConfig(
    { ...(buildConfig({ GHL_REMINDER_MODE: "live", GHL_DELIVERY_MODE: "live", ...ghlEnv() }).env) }, {});
  const dry = getGhlConfig(buildConfig({ GHL_REMINDER_MODE: "dry", GHL_DELIVERY_MODE: "dry" }).env, {});
  const worker = (client: GhlClient | null, now: Date, makeLink: (u: string, p: "activate" | "reset") => Promise<string> = async () => `${ORIGIN}/activate?token=x`) =>
    runGhlOutbox({ db, cfg: live, client, now, log, timeZone: "Asia/Jerusalem", origin: ORIGIN, makeLink, random: () => 0 });

  // 2026-12-03 (day 3) 07:30 Israel = 05:30Z
  const DAY3 = new Date("2026-12-03T05:30:00Z");

  beforeAll(() => { db = createDb(url!); });
  beforeEach(async () => {
    lines.length = 0;
    await db.delete(schema.users);
    await db.execute(sql`delete from sync_outbox`);
  });
  afterAll(async () => { await db.delete(schema.users); });

  describe("reminders", () => {
    it("mode off (default): runReminders adds no ghl part and writes no ghl rows", async () => {
      await mkUser({ sub: true });
      const config = buildConfig({ START_DATE: "2026-12-01" });
      const r = await runReminders({ db, config, sender: createDryRunPushSender(), now: DAY3 });
      expect(r.ghl).toBeUndefined();
      expect(await count("reminder_log", sql`channel = 'ghl'`)).toBe(0);
      expect(await count("sync_outbox")).toBe(0);
    });

    it("dry: logs what would be sent, writes dry_run log rows (once per user and date), no outbox, no client", async () => {
      const a = await mkUser();
      await mkUser({ contact: null }); // no contact: skipped
      await mkUser({ activated: false }); // not activated: skipped
      const r1 = await queueGhlReminders({ db, cfg: dry, day: 3, date: "2026-12-03", log });
      expect(r1).toEqual({ mode: "dry", claimed: 1 });
      expect(await queueGhlReminders({ db, cfg: dry, day: 3, date: "2026-12-03", log })).toEqual({ mode: "dry", claimed: 0 });
      expect(await count("reminder_log", sql`channel = 'ghl' and status = 'dry_run'`)).toBe(1);
      expect(await count("sync_outbox")).toBe(0);
      const out = lines.join("\n");
      expect(out).toContain("ghl reminder dry-run");
      expect(out).toContain("tsaad_reminder_day3");
      expect(out).toContain(a.id);
      expect(out).not.toContain("521234567");
    });

    it("a user with both push and ghl gets one row per channel for the date", async () => {
      await mkUser({ sub: true });
      const config = buildConfig({ START_DATE: "2026-12-01", GHL_REMINDER_MODE: "dry" });
      const r = await runReminders({ db, config, sender: createDryRunPushSender(), now: DAY3 });
      expect(r).toMatchObject({ mode: "dry", claimed: 1, ghl: { mode: "dry", claimed: 1 } });
      expect(await count("reminder_log", sql`channel = 'push'`)).toBe(1);
      expect(await count("reminder_log", sql`channel = 'ghl'`)).toBe(1);
    });

    it("live: queues once per user and date, the worker sets the field and the day tag, then marks sent", async () => {
      const u = await mkUser();
      await queueGhlReminders({ db, cfg: live, day: 3, date: "2026-12-03", log });
      await queueGhlReminders({ db, cfg: live, day: 3, date: "2026-12-03", log }); // second run: nothing new
      expect(await count("sync_outbox", sql`kind = 'ghl_reminder'`)).toBe(1);
      const { client, calls, bodies } = okClient();
      const r = await worker(client, DAY3);
      expect(r).toMatchObject({ claimed: 1, sent: 1, failed: 0, dead: 0 });
      expect(calls).toEqual([`field ${u.ghlContactId}`, `add ${u.ghlContactId} tsaad_reminder_day3`]);
      expect(bodies[0]).toEqual([{ key: "tsaad_today_url", value: `${ORIGIN}/today` }]);
      expect(await count("reminder_log", sql`channel = 'ghl' and status = 'sent'`)).toBe(1);
      // a later run does not send again
      expect((await worker(client, DAY3)).claimed).toBe(0);
      expect(calls).toHaveLength(2);
    });

    it("a temporary failure retries with backoff and then succeeds; the log row stays pending until then", async () => {
      await mkUser();
      await queueGhlReminders({ db, cfg: live, day: 3, date: "2026-12-03", log });
      const { client } = okClient();
      (client.updateCustomFields as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, retryable: true, error: "ghl http 503" });
      expect(await worker(client, DAY3)).toMatchObject({ claimed: 1, sent: 0, failed: 1 });
      expect(await count("reminder_log", sql`channel='ghl' and status='pending'`)).toBe(1);
      expect((await worker(client, DAY3)).claimed).toBe(0); // backoff: not due yet
      await db.execute(sql`update sync_outbox set next_attempt_at = now()`);
      expect(await worker(client, DAY3)).toMatchObject({ claimed: 1, sent: 1 });
      expect(await count("reminder_log", sql`channel='ghl' and status='sent'`)).toBe(1);
    });

    it("a permanent failure goes dead and the log row becomes failed", async () => {
      await mkUser();
      await queueGhlReminders({ db, cfg: live, day: 3, date: "2026-12-03", log });
      const { client } = okClient();
      (client.updateCustomFields as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, retryable: false, error: "ghl http 404" });
      expect(await worker(client, DAY3)).toMatchObject({ dead: 1 });
      expect(await count("reminder_log", sql`channel='ghl' and status='failed'`)).toBe(1);
      expect(await count("sync_outbox", sql`status='dead'`)).toBe(1);
    });

    it("a retry after noon, or the next day, is dropped as stale (no late morning reminder)", async () => {
      await mkUser();
      await queueGhlReminders({ db, cfg: live, day: 3, date: "2026-12-03", log });
      const { client, calls } = okClient();
      expect(await worker(client, new Date("2026-12-03T10:30:00Z"))).toMatchObject({ dead: 1 }); // 12:30 Israel
      expect(calls).toHaveLength(0);
    });

    it("live without a client (token missing) claims nothing and touches no rows", async () => {
      await mkUser();
      await queueGhlReminders({ db, cfg: live, day: 3, date: "2026-12-03", log });
      expect(await worker(null, DAY3)).toEqual({ claimed: 0, sent: 0, failed: 0, dead: 0 });
      expect(await count("sync_outbox", sql`status='pending' and attempts=0`)).toBe(1);
    });

    it("concurrent workers never send the same row twice (SKIP LOCKED)", async () => {
      for (let i = 0; i < 6; i++) await mkUser();
      await queueGhlReminders({ db, cfg: live, day: 3, date: "2026-12-03", log });
      const { client, calls } = okClient();
      await Promise.all([worker(client, DAY3), worker(client, DAY3), worker(client, DAY3)]);
      expect(calls.filter((c) => c.startsWith("add"))).toHaveLength(6);
    });

    it("WhatsApp opt-out: no row is queued for a user who switched it off, and a queued row is dropped if they switch it off later", async () => {
      const off = await mkUser();
      const later = await mkUser();
      expect(await getWhatsappReminderPref(db, off.id)).toEqual({ on: true, hasContact: true }); // default on
      expect(await setWhatsappReminderPref(db, off.id, false)).toBe(false);
      expect(await queueGhlReminders({ db, cfg: live, day: 3, date: "2026-12-03", log })).toEqual({ mode: "live", claimed: 1 });
      expect(await count("reminder_log", sql`channel = 'ghl' and user_id = ${off.id}`)).toBe(0);
      await setWhatsappReminderPref(db, later.id, false);
      const { client, calls } = okClient();
      expect(await worker(client, DAY3)).toMatchObject({ claimed: 1, sent: 0, dead: 1 });
      expect(calls).toHaveLength(0);
      expect(await count("sync_outbox", sql`last_error = 'opted out'`)).toBe(1);
      // switching it back on takes effect from the next date
      await setWhatsappReminderPref(db, off.id, true);
      expect((await queueGhlReminders({ db, cfg: live, day: 4, date: "2026-12-04", log }))?.claimed).toBe(1);
      expect(await getWhatsappReminderPref(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
    });

    it("a 429 with Retry-After is not retried before that time", async () => {
      await mkUser();
      await queueGhlReminders({ db, cfg: live, day: 3, date: "2026-12-03", log });
      const { client } = okClient();
      (client.updateCustomFields as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, retryable: true, error: "ghl http 429", retryAfterSeconds: 1800 });
      expect(await worker(client, DAY3)).toMatchObject({ failed: 1 });
      const wait = rowsOf<{ s: number }>(await db.execute(sql`select extract(epoch from next_attempt_at - now())::int as s from sync_outbox`))[0].s;
      expect(wait).toBeGreaterThanOrEqual(1790);
    });

    it("claims in small chunks up to the row cap, and stops claiming once the run budget is spent", async () => {
      for (let i = 0; i < 5; i++) await mkUser();
      await queueGhlReminders({ db, cfg: live, day: 3, date: "2026-12-03", log });
      const { client, calls } = okClient();
      const base = { db, cfg: live, client, now: DAY3, log, timeZone: "Asia/Jerusalem", origin: ORIGIN, makeLink: async () => "x", random: () => 0 };
      expect(await runGhlOutbox({ ...base, runBudgetMs: 0 })).toMatchObject({ claimed: 0 });
      expect(await runGhlOutbox({ ...base, claimChunk: 2, maxRows: 3 })).toMatchObject({ claimed: 3, sent: 3 });
      expect(await runGhlOutbox({ ...base, claimChunk: 2 })).toMatchObject({ claimed: 2, sent: 2 });
      expect(calls.filter((c) => c.startsWith("add"))).toHaveLength(5);
    });

    it("the tracker worker never claims GHL rows, and the GHL worker never claims tracker rows", async () => {
      const u = await mkUser();
      await queueGhlReminders({ db, cfg: live, day: 3, date: "2026-12-03", log });
      await enqueueTrackerSync(db, { userId: u.id, day: 3 });
      const adapter = { name: "t", send: vi.fn(async () => ({ ok: true as const })) };
      const r = await runSyncWorker({ db, enabled: true, adapter, log });
      expect(r.claimed).toBe(1);
      expect(await count("sync_outbox", sql`kind='ghl_reminder' and status='pending' and attempts=0`)).toBe(1);
      const { client } = okClient();
      await enqueueTrackerSync(db, { userId: u.id, day: 4 });
      const g = await worker(client, DAY3);
      expect(g.claimed).toBe(1);
      expect(await count("sync_outbox", sql`kind='tracker' and status='pending'`)).toBe(1);
      expect(await claimDue(db, 10, 60, ["tracker"])).toHaveLength(1);
    });
  });

  describe("activation and reset links", () => {
    const makeLink = (purposeSeen: string[]) => async (userId: string, purpose: "activate" | "reset") => {
      purposeSeen.push(purpose);
      const { token } = await issueToken(db, { userId, purpose, ttlMinutes: 30 });
      return `${ORIGIN}/activate?token=${token}`;
    };

    it("live: writes the link to the field and adds the account-ready tag (re-armed); the link is not in the logs", async () => {
      const u = await mkUser({ activated: false });
      const { client, calls, bodies } = okClient();
      const d = createLinkDelivery({ cfg: live, client, db: () => db, log });
      const link = `${ORIGIN}/activate?token=SECRETTOKEN999`;
      expect(await d.deliver({ userId: u.id, ghlContactId: u.ghlContactId!, kind: "activate", link })).toBe("sent");
      expect(calls).toEqual([`field ${u.ghlContactId}`, `remove ${u.ghlContactId} tsaad_account_ready`, `add ${u.ghlContactId} tsaad_account_ready`]);
      expect(bodies[0]).toEqual([{ key: "tsaad_activation_url", value: link }]);
      expect(lines.join("\n")).not.toContain("SECRETTOKEN999");
    });

    it("with the field id configured, the id is sent along with the key", async () => {
      const u = await mkUser({ activated: false });
      const withId = getGhlConfig(buildConfig({ GHL_DELIVERY_MODE: "live", GHL_FIELD_ACTIVATION_URL_ID: "FieldId123456", ...ghlEnv() }).env, {});
      const { client, bodies } = okClient();
      await createLinkDelivery({ cfg: withId, client, db: () => db, log }).deliver({ userId: u.id, ghlContactId: u.ghlContactId!, kind: "activate", link: "l" });
      expect(bodies[0]).toEqual([{ key: "tsaad_activation_url", id: "FieldId123456", value: "l" }]);
    });

    it("a direct delivery cancels a retry still waiting for the same purpose (it would replace the fresh link)", async () => {
      const u = await mkUser({ activated: false });
      await enqueueLink(db, u.id, "activate");
      const { client } = okClient();
      expect(await createLinkDelivery({ cfg: live, client, db: () => db, log }).deliver({ userId: u.id, ghlContactId: u.ghlContactId!, kind: "activate", link: "l" })).toBe("sent");
      expect(await count("sync_outbox", sql`status = 'sent'`)).toBe(1);
      expect((await worker(client, DAY3, async () => "x")).claimed).toBe(0);
    });

    it("reset uses the reset tag", async () => {
      const u = await mkUser();
      const { client, calls } = okClient();
      const d = createLinkDelivery({ cfg: live, client, db: () => db, log });
      await d.deliver({ userId: u.id, ghlContactId: u.ghlContactId!, kind: "reset", link: `${ORIGIN}/activate?token=t` });
      expect(calls.at(-1)).toBe(`add ${u.ghlContactId} tsaad_reset_ready`);
    });

    it("a temporary failure queues an outbox row without the token; the worker issues a fresh link and sends it", async () => {
      const u = await mkUser({ activated: false });
      const failing = okClient();
      (failing.client.updateCustomFields as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, retryable: true, error: "ghl http 429" });
      const d = createLinkDelivery({ cfg: live, client: failing.client, db: () => db, log });
      const first = await issueToken(db, { userId: u.id, purpose: "activate", ttlMinutes: 30 });
      expect(await d.deliver({ userId: u.id, ghlContactId: u.ghlContactId!, kind: "activate", link: `${ORIGIN}/activate?token=${first.token}` })).toBe("queued");
      const row = rowsOf<{ payload: unknown }>(await db.execute(sql`select payload from sync_outbox`))[0];
      expect(row.payload).toEqual({ purpose: "activate" });
      expect(JSON.stringify(row)).not.toContain(first.token);

      const seen: string[] = [];
      const ok = okClient();
      expect(await worker(ok.client, DAY3, makeLink(seen))).toMatchObject({ claimed: 1, sent: 1 });
      expect(seen).toEqual(["activate"]);
      const sentLink = (ok.bodies[0] as { value: string }[])[0].value;
      const token = new URL(sentLink).searchParams.get("token")!;
      expect(token).not.toBe(first.token);
      // the old link no longer works, the new one is the only unused activation token
      expect(await count("activation_tokens", sql`used_at is null`)).toBe(1);
      expect(await count("activation_tokens", sql`token_hash = ${sha256Hex(token)}`)).toBe(1);
    });

    it("a queued activation for an account that has since been activated is skipped quietly", async () => {
      const u = await mkUser({ activated: true });
      await enqueueLink(db, u.id, "activate");
      const { client, calls } = okClient();
      expect(await worker(client, DAY3, makeLink([]))).toMatchObject({ claimed: 1, sent: 1 });
      expect(calls).toHaveLength(0);
    });

    it("forgot password: a user with a ghl contact goes through GHL (tag reset_ready), one without goes to the normal sender", async () => {
      const withContact = await mkUser();
      const without = await mkUser({ contact: null });
      const sent: string[] = [];
      const ghlCalls: { kind: string; userId: string }[] = [];
      const sender = { async send(m: { userId: string }) { sent.push(m.userId); } };
      const ghl = { async deliver(r: { kind: string; userId: string }) { ghlCalls.push(r); return "sent" as const; } };
      for (const u of [withContact, without]) {
        await requestPasswordReset(db, { identifier: u.username, secret: "s".repeat(32), ttlMinutes: 30, sender, origin: ORIGIN, ghl });
      }
      expect(ghlCalls).toEqual([{ kind: "reset", userId: withContact.id, ghlContactId: withContact.ghlContactId, link: expect.stringContaining("/activate?token=") }].map((x) => expect.objectContaining({ kind: x.kind, userId: x.userId })));
      expect([...new Set(sent)]).toEqual([without.id]);
    });

    it("dry delivery mode never writes to the outbox or calls a client", async () => {
      const u = await mkUser({ activated: false });
      const d = createLinkDelivery({ cfg: dry, client: null, db: () => db, log });
      expect(await d.deliver({ userId: u.id, ghlContactId: u.ghlContactId!, kind: "activate", link: `${ORIGIN}/activate?token=t` })).toBe("dry");
      expect(await count("sync_outbox")).toBe(0);
    });
  });
});
