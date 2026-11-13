// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildConfig } from "@/config";
import { copy } from "@/content/copy.he";
import { createDb, isLocalDatabaseUrl, schema, type Db } from "@/db";
import { rowsOf } from "@/lib/auth/sql";
import { createLogger } from "@/lib/logger";
import type { GhlClient } from "@/lib/ghl/client";
import { getGhlConfig } from "@/lib/ghl/config";
import { runGhlOutbox } from "@/lib/ghl/outbox";
import { runLiveReminders, runReminders, type PushSender } from "@/lib/push";

const url = process.env.DATABASE_URL;
const runIntegration = !!url && process.env.TSAAD_TEST_DB === "1" && isLocalDatabaseUrl(url);
const ORIGIN = "https://app.example.test";
const GHL = { GHL_API_TOKEN: "pit-0123456789abcdef0123456789abcdef", GHL_LOCATION_ID: "loc-123456" };
const d = (iso: string) => new Date(iso);

// START 2026-12-01 (Israel winter +02:00): day 7 = 2026-12-07 live 20:00 (window opens 19:00 local = 17:00Z).
const IN_WINDOW = d("2026-12-07T19:20:00+02:00");
const LIVE_ENV = { START_DATE: "2026-12-01", LIVE_TIME_DAY7: "20:00", LIVE_TIME_DAY14: "19:30" };

describe.skipIf(!runIntegration)("live reminders (integration)", () => {
  let db: Db;
  let n = 0;
  const lines: string[] = [];
  const log = createLogger({ level: "debug", sink: (l) => lines.push(l) });
  const count = async (table: string, where = sql`true`) =>
    rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from ${sql.raw(table)} where ${where}`))[0].n;

  const mkUser = async (o: { subs?: number; contact?: string | null; activated?: boolean; disabled?: boolean; wa?: boolean; reminderTime?: number } = {}) => {
    const i = ++n;
    const activated = o.activated ?? true;
    const [u] = await db
      .insert(schema.users)
      .values({
        username: `lr${i}`, displayName: "x", email: `lr${i}@example.test`, phone: "+972521234567",
        ghlContactId: o.contact === undefined ? `contact${i}abcdef` : o.contact,
        passwordHash: activated ? "h" : null,
        activatedAt: activated ? new Date() : null,
        disabledAt: o.disabled ? new Date() : null,
        whatsappReminders: o.wa ?? true,
        ...(o.reminderTime === undefined ? {} : { reminderTime: o.reminderTime }),
      })
      .returning();
    for (let s = 0; s < (o.subs ?? 0); s++) {
      await db.insert(schema.pushSubscriptions).values({ userId: u.id, endpoint: `https://fcm.googleapis.com/fcm/send/l${i}s${s}`, p256dh: "p", auth: "a" });
    }
    return u;
  };
  const fakeSender = () => {
    const sent: { endpoint: string; payload: string }[] = [];
    const sender: PushSender = { dryRun: false, async send(sub, payload) { sent.push({ endpoint: sub.endpoint, payload }); return { ok: true }; } };
    return { sender, sent };
  };
  const dryRunSender: PushSender = { dryRun: true, send: async () => ({ ok: true }) };
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
  const ghlLive = () => getGhlConfig(buildConfig({ ...LIVE_ENV, GHL_REMINDER_MODE: "live", ...GHL }).env, {});
  const worker = (client: GhlClient | null, now: Date) =>
    runGhlOutbox({ db, cfg: ghlLive(), client, now, log, timeZone: "Asia/Jerusalem", origin: ORIGIN, makeLink: async () => "x", random: () => 0 });

  beforeAll(() => { db = createDb(url!); });
  beforeEach(async () => {
    lines.length = 0;
    await db.delete(schema.users);
    await db.execute(sql`delete from sync_outbox`);
  });
  afterAll(async () => { await db.delete(schema.users); });

  describe("push", () => {
    it("default env (REMINDERS_ENABLED off): dry_run rows only, the sender is never called", async () => {
      await mkUser({ subs: 1 });
      const send = vi.fn();
      const r = await runLiveReminders({ db, config: buildConfig(LIVE_ENV), sender: { dryRun: true, send }, now: IN_WINDOW });
      expect(r).toMatchObject({ mode: "dry", day: 7, claimed: 1, sent: 0 });
      expect(send).not.toHaveBeenCalled();
      expect(await count("reminder_log", sql`channel = 'live_push' and status = 'dry_run' and date = '2026-12-07'`)).toBe(1);
    });

    it("enabled: sends the live text once to every active subscribed participant, whatever their daily time", async () => {
      const early = await mkUser({ subs: 1, reminderTime: 330 });
      const late = await mkUser({ subs: 2, reminderTime: 1260 });
      const { sender, sent } = fakeSender();
      const r = await runLiveReminders({ db, config: buildConfig({ ...LIVE_ENV, REMINDERS_ENABLED: "true" }), sender, now: IN_WINDOW });
      expect(r).toMatchObject({ mode: "live", day: 7, claimed: 2, sent: 2, failed: 0 });
      expect(sent).toHaveLength(3);
      const p = JSON.parse(sent[0].payload);
      expect(p).toMatchObject({ title: copy.push.liveTitle, body: copy.push.liveBody, url: "/live", tag: "live-7" });
      expect(await count("reminder_log", sql`channel = 'live_push' and status = 'sent'`)).toBe(2);
      expect(await count("reminder_log", sql`channel = 'live_push' and user_id in (${early.id}, ${late.id})`)).toBe(2);
    });

    it("is idempotent across repeated and parallel runs", async () => {
      await mkUser({ subs: 1 });
      await mkUser({ subs: 1 });
      const { sender, sent } = fakeSender();
      const config = buildConfig({ ...LIVE_ENV, REMINDERS_ENABLED: "true" });
      await Promise.all(Array.from({ length: 6 }, () => runLiveReminders({ db, config, sender, now: IN_WINDOW })));
      const again = await runLiveReminders({ db, config, sender, now: d("2026-12-07T19:50:00+02:00") });
      expect(again.claimed).toBe(0);
      expect(sent).toHaveLength(2);
      expect(await count("reminder_log", sql`channel = 'live_push'`)).toBe(2);
    });

    it("does not collide with the daily row: both are sent on a live day", async () => {
      await mkUser({ subs: 1 });
      const { sender, sent } = fakeSender();
      const config = buildConfig({ ...LIVE_ENV, REMINDERS_ENABLED: "true" });
      // daily at 07:30 local (05:30Z), then the live reminder at 19:20
      const daily = await runReminders({ db, config, sender, now: d("2026-12-07T07:30:00+02:00") });
      expect(daily.sent).toBe(1);
      const live = await runLiveReminders({ db, config, sender, now: IN_WINDOW });
      expect(live.sent).toBe(1);
      expect(sent.map((s) => JSON.parse(s.payload).tag)).toEqual(["day-7", "live-7"]);
      expect(await count("reminder_log", sql`channel = 'push'`)).toBe(1);
      expect(await count("reminder_log", sql`channel = 'live_push'`)).toBe(1);
      // the daily text on a live day has no live mention
      expect(JSON.parse(sent[0].payload).body).not.toMatch(/לייב|מפגש/);
    });

    it("a daily run in the live window does not take the live row and vice versa (separate channels)", async () => {
      await mkUser({ subs: 1, reminderTime: 1140 }); // 19:00
      const { sender, sent } = fakeSender();
      const config = buildConfig({ ...LIVE_ENV, REMINDERS_ENABLED: "true" });
      await runReminders({ db, config, sender, now: IN_WINDOW });
      await runLiveReminders({ db, config, sender, now: IN_WINDOW });
      expect(sent).toHaveLength(2);
    });

    it("skips disabled, not activated and unsubscribed users", async () => {
      await mkUser({ subs: 1, disabled: true });
      await mkUser({ subs: 1, activated: false });
      await mkUser({ subs: 0 });
      const ok = await mkUser({ subs: 1 });
      const { sender, sent } = fakeSender();
      const r = await runLiveReminders({ db, config: buildConfig({ ...LIVE_ENV, REMINDERS_ENABLED: "true" }), sender, now: IN_WINDOW });
      expect(r.claimed).toBe(1);
      expect(sent).toHaveLength(1);
      expect(await count("reminder_log", sql`channel = 'live_push' and user_id = ${ok.id}`)).toBe(1);
    });

    it("window: nothing before start-60, nothing at or after the start, nothing on other days", async () => {
      await mkUser({ subs: 1 });
      const { sender, sent } = fakeSender();
      const config = buildConfig({ ...LIVE_ENV, REMINDERS_ENABLED: "true" });
      for (const iso of ["2026-12-07T18:59:59+02:00", "2026-12-07T20:00:00+02:00", "2026-12-07T20:30:00+02:00", "2026-12-06T19:20:00+02:00", "2026-12-08T19:20:00+02:00"]) {
        const r = await runLiveReminders({ db, config, sender, now: d(iso) });
        expect(r.skipped, iso).toBe("no_live_in_window");
      }
      expect(sent).toHaveLength(0);
      expect(await count("reminder_log")).toBe(0);
      // exactly at start-60 it goes out
      expect((await runLiveReminders({ db, config, sender, now: d("2026-12-07T19:00:00+02:00") })).sent).toBe(1);
    });

    it("day 14 uses its own time and its own date row", async () => {
      await mkUser({ subs: 1 });
      const { sender, sent } = fakeSender();
      const config = buildConfig({ ...LIVE_ENV, REMINDERS_ENABLED: "true" });
      await runLiveReminders({ db, config, sender, now: IN_WINDOW });
      const r = await runLiveReminders({ db, config, sender, now: d("2026-12-14T18:45:00+02:00") });
      expect(r).toMatchObject({ day: 14, sent: 1 });
      expect(sent.map((s) => JSON.parse(s.payload).tag)).toEqual(["live-7", "live-14"]);
      expect(await count("reminder_log", sql`channel = 'live_push' and date = '2026-12-14'`)).toBe(1);
    });

    it("sends nothing when the live time is not configured", async () => {
      await mkUser({ subs: 1, contact: "contactxyzabcd" });
      const { sender, sent } = fakeSender();
      const config = buildConfig({ START_DATE: "2026-12-01", REMINDERS_ENABLED: "true", GHL_REMINDER_MODE: "dry" });
      const r = await runLiveReminders({ db, config, sender, now: IN_WINDOW });
      expect(r).toMatchObject({ mode: "skipped", skipped: "no_live_in_window" });
      expect(r.ghl).toBeUndefined();
      expect(sent).toHaveLength(0);
      expect(await count("reminder_log")).toBe(0);
    });

    it("enabled without VAPID keys: does not take the day, so nothing is lost", async () => {
      await mkUser({ subs: 1 });
      const r = await runLiveReminders({ db, config: buildConfig({ ...LIVE_ENV, REMINDERS_ENABLED: "true" }), sender: dryRunSender, now: IN_WINDOW });
      expect(r.skipped).toBe("no_vapid");
      expect(await count("reminder_log", sql`channel = 'live_push'`)).toBe(0);
    });
  });

  describe("ghl (whatsapp)", () => {
    it("mode off (default): no ghl part, no live_ghl rows, no outbox", async () => {
      await mkUser({ subs: 1 });
      const r = await runLiveReminders({ db, config: buildConfig(LIVE_ENV), sender: dryRunSender, now: IN_WINDOW });
      expect(r.ghl).toBeUndefined();
      expect(await count("reminder_log", sql`channel = 'live_ghl'`)).toBe(0);
      expect(await count("sync_outbox")).toBe(0);
    });

    it("dry: writes dry_run rows once per user and date, logs the tag, no outbox", async () => {
      await mkUser();
      await mkUser({ contact: null });
      const config = buildConfig({ ...LIVE_ENV, GHL_REMINDER_MODE: "dry" });
      const r1 = await runLiveReminders({ db, config, sender: dryRunSender, now: IN_WINDOW, log });
      expect(r1.ghl).toEqual({ mode: "dry", claimed: 1 });
      const r2 = await runLiveReminders({ db, config, sender: dryRunSender, now: IN_WINDOW, log });
      expect(r2.ghl).toEqual({ mode: "dry", claimed: 0 });
      expect(await count("reminder_log", sql`channel = 'live_ghl' and status = 'dry_run'`)).toBe(1);
      expect(await count("sync_outbox")).toBe(0);
      expect(lines.join("\n")).toContain("ghl live reminder dry-run");
      expect(lines.join("\n")).toContain("tsaad_live_reminder");
    });

    it("live: queues once, the worker writes the live time and adds the separate tag, then marks sent", async () => {
      const u = await mkUser();
      const config = buildConfig({ ...LIVE_ENV, GHL_REMINDER_MODE: "live", ...GHL });
      const cfg = ghlLive();
      await runLiveReminders({ db, config, sender: dryRunSender, now: IN_WINDOW, ghlConfig: cfg, log });
      await runLiveReminders({ db, config, sender: dryRunSender, now: d("2026-12-07T19:40:00+02:00"), ghlConfig: cfg, log });
      expect(await count("sync_outbox", sql`kind = 'ghl_live_reminder'`)).toBe(1);
      expect(await count("sync_outbox", sql`kind = 'ghl_reminder'`)).toBe(0);
      const { client, calls, bodies } = okClient();
      const r = await worker(client, d("2026-12-07T19:21:00+02:00"));
      expect(r).toMatchObject({ claimed: 1, sent: 1, failed: 0, dead: 0 });
      expect(calls).toEqual([`field ${u.ghlContactId}`, `remove ${u.ghlContactId} tsaad_live_reminder`, `add ${u.ghlContactId} tsaad_live_reminder`]);
      expect(bodies[0]).toEqual([{ key: "tsaad_live_time", value: "20:00" }]);
      expect(await count("reminder_log", sql`channel = 'live_ghl' and status = 'sent'`)).toBe(1);
      expect((await worker(client, IN_WINDOW)).claimed).toBe(0);
    });

    it("does not collide with the daily ghl row (both queue on a live day)", async () => {
      await mkUser();
      const config = buildConfig({ ...LIVE_ENV, GHL_REMINDER_MODE: "live", ...GHL });
      const cfg = ghlLive();
      await runReminders({ db, config, sender: dryRunSender, now: d("2026-12-07T07:30:00+02:00"), ghlConfig: cfg, log });
      await runLiveReminders({ db, config, sender: dryRunSender, now: IN_WINDOW, ghlConfig: cfg, log });
      expect(await count("reminder_log", sql`channel = 'ghl'`)).toBe(1);
      expect(await count("reminder_log", sql`channel = 'live_ghl'`)).toBe(1);
      const { client, calls } = okClient();
      await worker(client, d("2026-12-07T19:21:00+02:00"));
      // the daily row is stale by now (the daily window ended), the live one goes out
      expect(calls.filter((c) => c.startsWith("add"))).toEqual([expect.stringContaining("tsaad_live_reminder")]);
    });

    it("respects the whatsapp opt-out, disabled and non-activated users, and users without a contact", async () => {
      await mkUser({ wa: false });
      await mkUser({ disabled: true });
      await mkUser({ activated: false });
      await mkUser({ contact: null });
      const ok = await mkUser();
      const config = buildConfig({ ...LIVE_ENV, GHL_REMINDER_MODE: "dry" });
      const r = await runLiveReminders({ db, config, sender: dryRunSender, now: IN_WINDOW, log });
      expect(r.ghl?.claimed).toBe(1);
      expect(await count("reminder_log", sql`channel = 'live_ghl' and user_id = ${ok.id}`)).toBe(1);
    });

    it("opting out or being disabled after it was queued: the worker does not send", async () => {
      const a = await mkUser();
      const b = await mkUser();
      const config = buildConfig({ ...LIVE_ENV, GHL_REMINDER_MODE: "live", ...GHL });
      await runLiveReminders({ db, config, sender: dryRunSender, now: IN_WINDOW, ghlConfig: ghlLive(), log });
      await db.execute(sql`update users set whatsapp_reminders = false where id = ${a.id}`);
      await db.execute(sql`update users set disabled_at = now() where id = ${b.id}`);
      const { client, calls } = okClient();
      const r = await worker(client, d("2026-12-07T19:21:00+02:00"));
      expect(r).toMatchObject({ claimed: 2, sent: 0, dead: 2 });
      expect(calls).toEqual([]);
    });

    it("a retry that lands after the live started is dropped, never sent", async () => {
      await mkUser();
      const config = buildConfig({ ...LIVE_ENV, GHL_REMINDER_MODE: "live", ...GHL });
      await runLiveReminders({ db, config, sender: dryRunSender, now: IN_WINDOW, ghlConfig: ghlLive(), log });
      const { client, calls } = okClient();
      const r = await worker(client, d("2026-12-07T20:00:00+02:00"));
      expect(r).toMatchObject({ claimed: 1, sent: 0, dead: 1 });
      expect(calls).toEqual([]);
      expect(await count("reminder_log", sql`channel = 'live_ghl' and status = 'failed'`)).toBe(1);
    });

    it("sends nothing without a configured live time", async () => {
      await mkUser();
      const config = buildConfig({ START_DATE: "2026-12-01", GHL_REMINDER_MODE: "live", ...GHL });
      const r = await runLiveReminders({ db, config, sender: dryRunSender, now: IN_WINDOW, ghlConfig: ghlLive(), log });
      expect(r.skipped).toBe("no_live_in_window");
      expect(await count("sync_outbox")).toBe(0);
    });
  });
});
