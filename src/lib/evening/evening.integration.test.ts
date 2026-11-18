// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildConfig } from "@/config";
import { DAYS } from "@/content/days";
import { createDb, isLocalDatabaseUrl, schema, type Db } from "@/db";
import { rowsOf } from "@/lib/auth/sql";
import { createLogger } from "@/lib/logger";
import type { GhlClient } from "@/lib/ghl/client";
import { getGhlConfig } from "@/lib/ghl/config";
import { runGhlOutbox } from "@/lib/ghl/outbox";
import { runEveningReminders, type PushSender } from "@/lib/push";

const url = process.env.DATABASE_URL;
const runIntegration = !!url && process.env.TSAAD_TEST_DB === "1" && isLocalDatabaseUrl(url);
const ORIGIN = "https://app.example.test";
const GHL = { GHL_API_TOKEN: "pit-0123456789abcdef0123456789abcdef", GHL_LOCATION_ID: "loc-123456" };
const d = (iso: string) => new Date(iso);

// START 2026-12-01 (Israel +02:00): day 3 = 2026-12-03, evening 20:30 local.
const ENV = { START_DATE: "2026-12-01", EVENING_REMINDERS_MODE: "live", GHL_REMINDER_MODE: "live", ...GHL };
const EVE3 = d("2026-12-03T20:30:00+02:00");
const EVE14 = d("2026-12-14T20:30:00+02:00");
const EVE0 = d("2026-11-30T20:30:00+02:00");

describe.skipIf(!runIntegration)("evening reminders (integration)", () => {
  let db: Db;
  let n = 0;
  const lines: string[] = [];
  const log = createLogger({ level: "debug", sink: (l) => lines.push(l) });
  const count = async (table: string, where = sql`true`) =>
    rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from ${sql.raw(table)} where ${where}`))[0].n;

  const mkUser = async (o: { subs?: number; contact?: string | null; activated?: boolean; disabled?: boolean; wa?: boolean } = {}) => {
    const i = ++n;
    const activated = o.activated ?? true;
    const [u] = await db
      .insert(schema.users)
      .values({
        username: `ev${i}`, displayName: "x", email: `ev${i}@example.test`, phone: "+972521234567",
        ghlContactId: o.contact === undefined ? `contact${i}abcdef` : o.contact,
        passwordHash: activated ? "h" : null,
        activatedAt: activated ? new Date() : null,
        disabledAt: o.disabled ? new Date() : null,
        whatsappReminders: o.wa ?? true,
      })
      .returning();
    for (let s = 0; s < (o.subs ?? 0); s++) {
      await db.insert(schema.pushSubscriptions).values({ userId: u.id, endpoint: `https://fcm.googleapis.com/fcm/send/e${i}s${s}`, p256dh: "p", auth: "a" });
    }
    return u;
  };
  const complete = (userId: string, day: number) => db.insert(schema.actionCompletions).values({ userId, day, action: "habit" });
  const fakeSender = () => {
    const sent: { endpoint: string; payload: string }[] = [];
    const sender: PushSender = { dryRun: false, async send(sub, payload) { sent.push({ endpoint: sub.endpoint, payload }); return { ok: true }; } };
    return { sender, sent };
  };
  const okClient = () => {
    const calls: string[] = [];
    const bodies: { key: string; id?: string; value: string }[][] = [];
    const client: GhlClient = {
      updateCustomFields: vi.fn(async (c, f) => (calls.push(`field ${c}`), bodies.push(f), { ok: true as const })),
      addTags: vi.fn(async (c, t) => (calls.push(`add ${c} ${t.join()}`), { ok: true as const })),
      removeTags: vi.fn(async (c, t) => (calls.push(`remove ${c} ${t.join()}`), { ok: true as const })),
    };
    return { client, calls, bodies };
  };
  const cfgOf = (extra: Record<string, string> = {}) => getGhlConfig(buildConfig({ ...ENV, ...extra }).env, {});
  const queue = (now: Date, extra: Record<string, string> = {}) =>
    runEveningReminders({ db, config: buildConfig({ ...ENV, ...extra }), sender: { dryRun: true, send: async () => ({ ok: true }) }, now, log, ghlConfig: cfgOf(extra) });
  const worker = (client: GhlClient | null, now: Date) =>
    runGhlOutbox({ db, cfg: cfgOf(), client, now, log, timeZone: "Asia/Jerusalem", origin: ORIGIN, makeLink: async () => "x", random: () => 0 });

  beforeAll(() => { db = createDb(url!); });
  beforeEach(async () => {
    lines.length = 0;
    await db.delete(schema.users);
    await db.execute(sql`delete from sync_outbox`);
  });
  afterAll(async () => { await db.delete(schema.users); });

  describe("queueing (GHL)", () => {
    it("mode off (default): nothing is queued, no ghl part", async () => {
      await mkUser({ subs: 1 });
      const r = await runEveningReminders({ db, config: buildConfig({ START_DATE: "2026-12-01" }), sender: { dryRun: true, send: async () => ({ ok: true }) }, now: EVE3 });
      expect(r).toMatchObject({ mode: "skipped", skipped: "off" });
      expect(await count("reminder_log", sql`channel in ('evening_ghl','evening_push')`)).toBe(0);
      expect(await count("sync_outbox")).toBe(0);
    });

    it("not due before 20:30, nothing after 23:00, nothing outside day 0..14", async () => {
      await mkUser();
      expect(await queue(d("2026-12-03T20:29:00+02:00"))).toMatchObject({ skipped: "not_due" });
      expect(await queue(d("2026-12-03T23:00:00+02:00"))).toMatchObject({ skipped: "not_due" });
      expect(await queue(d("2026-11-29T20:30:00+02:00"))).toMatchObject({ skipped: "out_of_range" });
      expect(await queue(d("2026-12-15T20:30:00+02:00"))).toMatchObject({ skipped: "out_of_range" });
      expect(await count("sync_outbox")).toBe(0);
    });

    it("live: one row per user and date, repeated runs and a later run add nothing; payload has no PII", async () => {
      const u = await mkUser();
      const r = await queue(EVE3);
      expect(r.ghl).toEqual({ mode: "live", claimed: 1 });
      await queue(EVE3);
      await queue(d("2026-12-03T22:45:00+02:00"));
      expect(await count("sync_outbox", sql`kind = 'ghl_evening_reminder'`)).toBe(1);
      expect(await count("reminder_log", sql`channel = 'evening_ghl' and status = 'pending'`)).toBe(1);
      const p = rowsOf<{ payload: unknown; dedupe_key: string }>(await db.execute(sql`select payload, dedupe_key from sync_outbox`))[0];
      expect(p.payload).toEqual({ date: "2026-12-03", day: 3 });
      expect(p.dedupe_key).toBe(`ghl_evening_reminder:${u.id}:2026-12-03`);
    });

    it("dry (GHL mode dry): dry_run rows, no outbox", async () => {
      await mkUser();
      const r = await queue(EVE3, { GHL_REMINDER_MODE: "dry" });
      expect(r.ghl).toEqual({ mode: "dry", claimed: 1 });
      expect(await count("reminder_log", sql`channel = 'evening_ghl' and status = 'dry_run'`)).toBe(1);
      expect(await count("sync_outbox")).toBe(0);
      expect(lines.join("\n")).toContain("ghl evening reminder dry-run");
    });

    it("skips users without a contact, not activated, disabled, or opted out", async () => {
      await mkUser({ contact: null });
      await mkUser({ activated: false });
      await mkUser({ disabled: true });
      await mkUser({ wa: false });
      const ok = await mkUser();
      expect((await queue(EVE3)).ghl).toEqual({ mode: "live", claimed: 1 });
      expect(await count("reminder_log", sql`channel = 'evening_ghl' and user_id = ${ok.id}`)).toBe(1);
    });
  });

  describe("variant chosen at send time", () => {
    it("open: not completed: both fields (habit, practice of tomorrow) then the open tag, tag re-armed", async () => {
      const u = await mkUser();
      await queue(EVE3);
      const { client, calls, bodies } = okClient();
      expect(await worker(client, EVE3)).toMatchObject({ claimed: 1, sent: 1, dead: 0 });
      expect(calls).toEqual([`field ${u.ghlContactId}`, `remove ${u.ghlContactId} tsaad_evening_open`, `add ${u.ghlContactId} tsaad_evening_open`]);
      expect(bodies[0]).toEqual([
        { key: "tsaad_tomorrow_habit", value: DAYS[3].habit.title },
        { key: "tsaad_tomorrow_practice", value: DAYS[3].movement.title },
      ]);
      expect(await count("reminder_log", sql`channel = 'evening_ghl' and status = 'sent'`)).toBe(1);
    });

    it("the variant follows completion at SEND time, not at queue time", async () => {
      const u = await mkUser();
      await queue(EVE3); // queued while the day is still open
      await complete(u.id, 3); // completed before the worker runs
      const { client, calls } = okClient();
      await worker(client, EVE3);
      expect(calls[2]).toBe(`add ${u.ghlContactId} tsaad_evening_done`);
    });

    it("done: completed: the done tag, with the tomorrow fields", async () => {
      const u = await mkUser();
      await complete(u.id, 3);
      await queue(EVE3);
      const { client, calls, bodies } = okClient();
      await worker(client, EVE3);
      expect(calls).toEqual([`field ${u.ghlContactId}`, `remove ${u.ghlContactId} tsaad_evening_done`, `add ${u.ghlContactId} tsaad_evening_done`]);
      expect(bodies[0]).toHaveLength(2);
    });

    it("day 0: always done, only the tomorrow part (day 1)", async () => {
      const u = await mkUser();
      expect((await queue(EVE0)).ghl).toEqual({ mode: "live", claimed: 1 });
      const { client, calls, bodies } = okClient();
      await worker(client, EVE0);
      expect(calls[2]).toBe(`add ${u.ghlContactId} tsaad_evening_done`);
      expect(bodies[0]).toEqual([
        { key: "tsaad_tomorrow_habit", value: DAYS[0].habit.title },
        { key: "tsaad_tomorrow_practice", value: DAYS[0].movement.title },
      ]);
    });

    it("day 14 not completed: last, no fields, tag only", async () => {
      const u = await mkUser();
      await queue(EVE14);
      const { client, calls } = okClient();
      expect(await worker(client, EVE14)).toMatchObject({ sent: 1 });
      expect(calls).toEqual([`remove ${u.ghlContactId} tsaad_evening_last`, `add ${u.ghlContactId} tsaad_evening_last`]);
      expect(client.updateCustomFields).not.toHaveBeenCalled();
    });

    it("day 14 completed: nothing sent to GHL, the row is closed as sent", async () => {
      const u = await mkUser();
      await queue(EVE14);
      await complete(u.id, 14);
      const { client, calls } = okClient();
      expect(await worker(client, EVE14)).toMatchObject({ claimed: 1, sent: 1, dead: 0 });
      expect(calls).toHaveLength(0);
      expect(await count("reminder_log", sql`channel = 'evening_ghl' and status = 'sent'`)).toBe(1);
    });

    it("custom field names and ids from the env are used", async () => {
      await mkUser();
      await queue(EVE3);
      const { client, bodies } = okClient();
      const cfg = cfgOf({ GHL_FIELD_TOMORROW_HABIT_ID: "habitfield1", GHL_FIELD_TOMORROW_PRACTICE_ID: "practfield1" });
      await runGhlOutbox({ db, cfg, client, now: EVE3, log, timeZone: "Asia/Jerusalem", origin: ORIGIN, makeLink: async () => "x", random: () => 0 });
      expect(bodies[0].map((f) => f.id)).toEqual(["habitfield1", "practfield1"]);
    });
  });

  describe("worker guards", () => {
    it("stale: after the 23:00 cutoff, or on another date, the row is dropped and GHL is not called", async () => {
      await mkUser();
      await queue(EVE3);
      const { client, calls } = okClient();
      expect(await worker(client, d("2026-12-03T23:00:00+02:00"))).toMatchObject({ dead: 1, sent: 0 });
      expect(calls).toHaveLength(0);
      expect(await count("sync_outbox", sql`status = 'dead' and last_error like '%stale evening reminder%'`)).toBe(1);
      expect(await count("reminder_log", sql`channel = 'evening_ghl' and status = 'failed'`)).toBe(1);
      await db.execute(sql`update sync_outbox set status = 'pending', attempts = 0, next_attempt_at = now()`);
      expect(await worker(client, d("2026-12-04T20:45:00+02:00"))).toMatchObject({ dead: 1 });
      expect(calls).toHaveLength(0);
    });

    it("a retry just before the cutoff still sends", async () => {
      await mkUser();
      await queue(EVE3);
      const { client } = okClient();
      expect(await worker(client, d("2026-12-03T22:59:00+02:00"))).toMatchObject({ sent: 1 });
    });

    it("opt-out or disabled after queueing: the row is dropped, nothing sent", async () => {
      const a = await mkUser();
      const b = await mkUser();
      await queue(EVE3);
      await db.execute(sql`update users set whatsapp_reminders = false where id = ${a.id}`);
      await db.execute(sql`update users set disabled_at = now() where id = ${b.id}`);
      const { client, calls } = okClient();
      expect(await worker(client, EVE3)).toMatchObject({ claimed: 2, sent: 0, dead: 2 });
      expect(calls).toHaveLength(0);
    });

    it("the evening kind is processed only when the evening mode is live", async () => {
      await mkUser();
      await queue(EVE3);
      const { client } = okClient();
      const dryCfg = cfgOf({ EVENING_REMINDERS_MODE: "dry" });
      expect((await runGhlOutbox({ db, cfg: dryCfg, client, now: EVE3, log, timeZone: "Asia/Jerusalem", origin: ORIGIN, makeLink: async () => "x" })).claimed).toBe(0);
    });

    it("a temporary failure retries and the log row stays pending until it succeeds", async () => {
      await mkUser();
      await queue(EVE3);
      const { client } = okClient();
      (client.updateCustomFields as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, retryable: true, error: "ghl http 503" });
      expect(await worker(client, EVE3)).toMatchObject({ failed: 1 });
      expect(await count("reminder_log", sql`channel = 'evening_ghl' and status = 'pending'`)).toBe(1);
      await db.execute(sql`update sync_outbox set next_attempt_at = now()`);
      expect(await worker(client, EVE3)).toMatchObject({ sent: 1 });
    });
  });

  describe("push", () => {
    it("default (REMINDERS_ENABLED off): dry_run rows, the sender is never called", async () => {
      await mkUser({ subs: 1 });
      const send = vi.fn();
      const r = await runEveningReminders({ db, config: buildConfig({ START_DATE: "2026-12-01", EVENING_REMINDERS_MODE: "live" }), sender: { dryRun: true, send }, now: EVE3 });
      expect(r).toMatchObject({ mode: "dry", day: 3, claimed: 1, sent: 0 });
      expect(send).not.toHaveBeenCalled();
      expect(await count("reminder_log", sql`channel = 'evening_push' and status = 'dry_run' and date = '2026-12-03'`)).toBe(1);
    });

    it("evening dry mode with REMINDERS_ENABLED on still sends nothing", async () => {
      await mkUser({ subs: 1 });
      const { sender, sent } = fakeSender();
      const r = await runEveningReminders({ db, config: buildConfig({ START_DATE: "2026-12-01", EVENING_REMINDERS_MODE: "dry", REMINDERS_ENABLED: "true" }), sender, now: EVE3 });
      expect(r.mode).toBe("dry");
      expect(sent).toHaveLength(0);
    });

    it("enabled: one payload per variant group, once per user and date", async () => {
      const open = await mkUser({ subs: 1 });
      const done = await mkUser({ subs: 1 });
      await complete(done.id, 3);
      const { sender, sent } = fakeSender();
      const config = buildConfig({ START_DATE: "2026-12-01", EVENING_REMINDERS_MODE: "live", REMINDERS_ENABLED: "true" });
      const r = await runEveningReminders({ db, config, sender, now: EVE3 });
      expect(r).toMatchObject({ mode: "live", day: 3, claimed: 2, sent: 2, failed: 0 });
      const byEndpoint = new Map(sent.map((s) => [s.endpoint, JSON.parse(s.payload)]));
      const bodyOf = async (id: string) => {
        const ep = rowsOf<{ endpoint: string }>(await db.execute(sql`select endpoint from push_subscriptions where user_id = ${id}`))[0].endpoint;
        return byEndpoint.get(ep);
      };
      expect(await bodyOf(open.id)).toMatchObject({ title: "ערב טוב \u{1F319}", body: `אם עוד לא יצא לכם לתרגל היום, יש עוד זמן. מחר בבוקר: ${DAYS[3].habit.title}.`, url: "/today", tag: "evening-3" });
      expect((await bodyOf(done.id)).body).toBe(`מחר בבוקר מחכה לכם: ${DAYS[3].habit.title}. לילה טוב.`);
      await runEveningReminders({ db, config, sender, now: d("2026-12-03T21:00:00+02:00") });
      expect(sent).toHaveLength(2);
      expect(await count("reminder_log", sql`channel = 'evening_push' and status = 'sent'`)).toBe(2);
    });

    it("day 14: last for the open, nothing for the completed (row closed as sent)", async () => {
      const open = await mkUser({ subs: 1 });
      const done = await mkUser({ subs: 1 });
      await complete(done.id, 14);
      const { sender, sent } = fakeSender();
      const config = buildConfig({ START_DATE: "2026-12-01", EVENING_REMINDERS_MODE: "live", REMINDERS_ENABLED: "true" });
      const r = await runEveningReminders({ db, config, sender, now: EVE14 });
      expect(r).toMatchObject({ claimed: 2, sent: 1 });
      expect(sent).toHaveLength(1);
      expect(JSON.parse(sent[0].payload)).toMatchObject({ tag: "evening-14", body: expect.stringContaining("היום האחרון") });
      expect(await count("reminder_log", sql`channel = 'evening_push' and status = 'sent' and user_id in (${open.id}, ${done.id})`)).toBe(2);
    });

    it("enabled but no VAPID sender: nothing claimed for push", async () => {
      await mkUser({ subs: 1 });
      const config = buildConfig({ START_DATE: "2026-12-01", EVENING_REMINDERS_MODE: "live", REMINDERS_ENABLED: "true" });
      const r = await runEveningReminders({ db, config, sender: { dryRun: true, send: async () => ({ ok: true }) }, now: EVE3 });
      expect(r).toMatchObject({ skipped: "no_vapid" });
      expect(await count("reminder_log", sql`channel = 'evening_push'`)).toBe(0);
    });

    it("a live-day collision moves the evening to the live end", async () => {
      await mkUser({ subs: 1 });
      const env = { START_DATE: "2026-12-01", EVENING_REMINDERS_MODE: "live", LIVE_TIME_DAY7: "20:00" };
      const send = vi.fn();
      const sender: PushSender = { dryRun: true, send };
      expect(await runEveningReminders({ db, config: buildConfig(env), sender, now: d("2026-12-07T20:45:00+02:00") })).toMatchObject({ skipped: "not_due", day: 7 });
      expect(await runEveningReminders({ db, config: buildConfig(env), sender, now: d("2026-12-07T21:00:00+02:00") })).toMatchObject({ mode: "dry", claimed: 1 });
    });
  });
});
