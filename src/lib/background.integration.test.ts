// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildConfig } from "@/config";
import { REMINDERS } from "@/config/constants";
import { createDb, isLocalDatabaseUrl, schema, type Db } from "@/db";
import { rowsOf } from "@/lib/auth/sql";
import { purgeExpired } from "@/lib/auth/session";
import { runCleanup } from "@/lib/maintenance/cleanup";
import {
  createDryRunPushSender,
  runReminders,
  type PushSendResult,
  type PushSender,
  type PushSubscriptionData,
} from "@/lib/push";
import {
  claimDue,
  createMockSyncAdapter,
  enqueueTrackerSync,
  markFailed,
  markSent,
  runSyncWorker,
} from "@/lib/sync";
import { GET as cleanupGET } from "@/app/api/cron/cleanup/route";
import { GET as remindersGET } from "@/app/api/cron/reminders/route";

// אם web-push היה נטען ונקרא, הבדיקה "לא נשלח כלום" הייתה נופלת.
const webPushSend = vi.hoisted(() => vi.fn());
vi.mock("web-push", () => ({ sendNotification: webPushSend, setVapidDetails: vi.fn() }));
// The reminders route reads serverNow() (request headers, for the guarded test clock); outside a request: the real time.
vi.mock("@/lib/today/clock", () => ({ serverNow: async () => new Date() }));

const url = process.env.DATABASE_URL;
const runIntegration = !!url && process.env.TSAAD_TEST_DB === "1" && isLocalDatabaseUrl(url);

const d = (iso: string) => new Date(iso);

describe.skipIf(!runIntegration)("background layer (integration)", () => {
  let db: Db;
  const { users, pushSubscriptions } = schema;
  let n = 0;

  const count = async (table: string, where = sql`true`) =>
    rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from ${sql.raw(table)} where ${where}`))[0].n;

  const mkUser = async (
    opts: { activated?: boolean; subs?: number; ghl?: string | null; phone?: string } = {},
  ) => {
    const i = ++n;
    const activated = opts.activated ?? true;
    const [u] = await db
      .insert(users)
      .values({
        username: `user${i}`,
        displayName: `Dana Cohen ${i}`,
        email: `dana${i}@example.test`,
        phone: opts.phone ?? "052-123-4567",
        ghlContactId: opts.ghl === undefined ? `ghl-${i}` : opts.ghl,
        passwordHash: activated ? "hash" : null,
        activatedAt: activated ? new Date() : null,
      })
      .returning();
    for (let s = 0; s < (opts.subs ?? 1); s++) {
      await db.insert(pushSubscriptions).values({
        userId: u.id,
        endpoint: `https://fcm.googleapis.com/fcm/send/u${i}s${s}`,
        p256dh: "p",
        auth: "a",
      });
    }
    return u;
  };

  /** שולח מזויף שסופר שליחות. */
  const fakeSender = (decide: (s: PushSubscriptionData) => PushSendResult = () => ({ ok: true })) => {
    const sent: { sub: PushSubscriptionData; payload: string }[] = [];
    const sender: PushSender = {
      dryRun: false,
      async send(sub, payload) {
        sent.push({ sub, payload });
        return decide(sub);
      },
    };
    return { sender, sent };
  };

  const cfg = (env: Record<string, string> = {}) =>
    buildConfig({ START_DATE: "2026-12-01", ...env });

  beforeAll(() => {
    db = createDb(url!);
  });
  beforeEach(async () => {
    await db.delete(users);
    await db.execute(sql`delete from webhook_events`);
    webPushSend.mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await db.delete(users);
  });

  // 2026-12-01 הוא יום 1 (שעון חורף, UTC+2). 07:30 מקומי = 05:30Z.
  const DAY1_0730 = d("2026-12-01T05:30:00Z");

  describe("default environment: nothing is sent", () => {
    it("REMINDERS_ENABLED unset: dry_run rows, zero sends, zero network", async () => {
      const u = await mkUser({ subs: 2 });
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const { sender, sent } = fakeSender();
      const config = cfg(); // REMINDERS_ENABLED לא הוגדר
      expect(config.env.REMINDERS_ENABLED).toBe(false);

      const r = await runReminders({ db, config, sender, now: DAY1_0730 });
      expect(r).toMatchObject({ mode: "dry", day: 1, claimed: 1, sent: 0 });
      expect(sent).toHaveLength(0);
      expect(webPushSend).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      const rows = await db.select().from(schema.reminderLog);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ userId: u.id, date: "2026-12-01", status: "dry_run" });
      expect(await count("push_subscriptions")).toBe(2); // שום מחיקה
    });

    it("real-looking sender is never called in dry mode, and the default dry-run sender is inert", async () => {
      await mkUser();
      const send = vi.fn();
      const spy: PushSender = { dryRun: false, send };
      await runReminders({ db, config: cfg(), sender: spy, now: DAY1_0730 });
      expect(send).not.toHaveBeenCalled();
      await runReminders({ db, config: cfg(), sender: createDryRunPushSender(), now: DAY1_0730 });
      expect(webPushSend).not.toHaveBeenCalled();
    });

    it("sync: TRACKER_SYNC_ENABLED unset leaves the outbox untouched and the adapter uncalled", async () => {
      const u = await mkUser();
      await enqueueTrackerSync(db, { userId: u.id, day: 1 });
      const adapter = createMockSyncAdapter();
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const config = cfg();
      expect(config.env.TRACKER_SYNC_ENABLED).toBe(false);
      const r = await runSyncWorker({ db, enabled: config.env.TRACKER_SYNC_ENABLED, adapter });
      expect(r).toMatchObject({ enabled: false, claimed: 0 });
      expect(adapter.calls).toHaveLength(0);
      expect(fetchSpy).not.toHaveBeenCalled();
      const [row] = await db.select().from(schema.syncOutbox);
      expect(row).toMatchObject({ status: "pending", attempts: 0 });
    });

    it("enabled flag with VAPID missing: nothing claimed, day not consumed", async () => {
      await mkUser();
      const r = await runReminders({
        db,
        config: cfg({ REMINDERS_ENABLED: "true" }),
        sender: createDryRunPushSender(),
        now: DAY1_0730,
      });
      expect(r).toMatchObject({ mode: "skipped", skipped: "no_vapid", claimed: 0 });
      expect(await count("reminder_log")).toBe(0);
    });
  });

  describe("reminder rules", () => {
    const live = () => cfg({ REMINDERS_ENABLED: "true" });

    it("sends once per user per day under concurrent runs", async () => {
      const users3 = [await mkUser({ subs: 2 }), await mkUser(), await mkUser()];
      const { sender, sent } = fakeSender();
      const results = await Promise.all(
        Array.from({ length: 8 }, () => runReminders({ db, config: live(), sender, now: DAY1_0730 })),
      );
      expect(sent).toHaveLength(4); // 2 + 1 + 1 מנויים, פעם אחת
      expect(new Set(sent.map((s) => s.sub.endpoint)).size).toBe(4);
      expect(results.reduce((a, r) => a + r.claimed, 0)).toBe(3);
      const rows = await db.select().from(schema.reminderLog);
      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.status === "sent")).toBe(true);
      expect(new Set(rows.map((r) => r.userId))).toEqual(new Set(users3.map((u) => u.id)));
      // ריצה מאוחרת יותר באותו יום: כלום.
      const again = await runReminders({ db, config: live(), sender, now: d("2026-12-01T08:00:00Z") });
      expect(again.claimed).toBe(0);
      expect(sent).toHaveLength(4);
    });

    it("claims in bounded batches: one run drains all batches, concurrent runs still send once", async () => {
      for (let i = 0; i < 7; i++) await mkUser();
      const { sender, sent } = fakeSender();
      const results = await Promise.all(
        Array.from({ length: 3 }, () =>
          runReminders({ db, config: live(), sender, now: DAY1_0730, claimBatchSize: 2 }),
        ),
      );
      const leftover = await runReminders({ db, config: live(), sender, now: DAY1_0730, claimBatchSize: 2 });
      expect(results.reduce((a, r) => a + r.claimed, 0) + leftover.claimed).toBe(7);
      expect(sent).toHaveLength(7);
      expect(new Set(sent.map((s) => s.sub.endpoint)).size).toBe(7);
      expect(await count("reminder_log", sql`status = 'sent'`)).toBe(7);
    });

    it("stops claiming new batches once the run budget is spent; the next run picks up the rest", async () => {
      for (let i = 0; i < 5; i++) await mkUser();
      const { sender, sent } = fakeSender();
      const first = await runReminders({ db, config: live(), sender, now: DAY1_0730, claimBatchSize: 2, runBudgetMs: 0 });
      expect(first.claimed).toBe(2);
      expect(await count("reminder_log", sql`status = 'pending'`)).toBe(0);
      const later = await runReminders({ db, config: live(), sender, now: d("2026-12-01T05:45:00Z"), claimBatchSize: 2 });
      expect(later.claimed).toBe(3);
      expect(sent).toHaveLength(5);
    });

    it("sends to at most maxSubscriptionsPerUser (newest) subscriptions per user", async () => {
      await mkUser({ subs: 8 });
      const { sender, sent } = fakeSender();
      const r = await runReminders({ db, config: live(), sender, now: DAY1_0730 });
      expect(r.sent).toBe(1);
      expect(sent).toHaveLength(REMINDERS.maxSubscriptionsPerUser);
    });

    it("sends again the next Israel date", async () => {
      await mkUser();
      const { sender, sent } = fakeSender();
      await runReminders({ db, config: live(), sender, now: DAY1_0730 });
      await runReminders({ db, config: live(), sender, now: d("2026-12-02T05:30:00Z") });
      expect(sent).toHaveLength(2);
      expect(JSON.parse(sent[1].payload).tag).toBe("day-2");
    });

    it("not before 07:30 local, and the first run after it still sends", async () => {
      await mkUser();
      const { sender, sent } = fakeSender();
      const early = await runReminders({ db, config: live(), sender, now: d("2026-12-01T05:29:59Z") });
      expect(early).toMatchObject({ mode: "skipped", skipped: "too_early" });
      expect(await count("reminder_log")).toBe(0);
      const late = await runReminders({ db, config: live(), sender, now: d("2026-12-01T07:12:00Z") }); // 09:12
      expect(late.claimed).toBe(1);
      expect(sent).toHaveLength(1);
    });

    it("nothing at or after the 12:00 cutoff; 11:59 still sends", async () => {
      await mkUser();
      const { sender, sent } = fakeSender();
      const after = await runReminders({ db, config: live(), sender, now: d("2026-12-01T10:00:00Z") });
      expect(after).toMatchObject({ mode: "skipped", skipped: "past_cutoff" });
      expect(sent).toHaveLength(0);
      const justBefore = await runReminders({ db, config: live(), sender, now: d("2026-12-01T09:59:00Z") });
      expect(justBefore.claimed).toBe(1);
    });

    it("skips unactivated users and users without a subscription", async () => {
      await mkUser({ activated: false });
      await mkUser({ subs: 0 });
      const ok = await mkUser();
      const { sender, sent } = fakeSender();
      await runReminders({ db, config: live(), sender, now: DAY1_0730 });
      expect(sent).toHaveLength(1);
      const rows = await db.select().from(schema.reminderLog);
      expect(rows.map((r) => r.userId)).toEqual([ok.id]);
    });

    it("skips day 0 (before start) and day 15 (after the end), runs on day 1 and day 14", async () => {
      await mkUser();
      const { sender, sent } = fakeSender();
      const before = await runReminders({ db, config: live(), sender, now: d("2026-11-30T06:00:00Z") });
      expect(before).toMatchObject({ mode: "skipped", skipped: "no_active_day" });
      const ended = await runReminders({ db, config: live(), sender, now: d("2026-12-15T06:00:00Z") });
      expect(ended).toMatchObject({ mode: "skipped", skipped: "no_active_day" });
      const last = await runReminders({ db, config: live(), sender, now: d("2026-12-14T06:00:00Z") });
      expect(last).toMatchObject({ day: 14, claimed: 1 });
      expect(sent).toHaveLength(1);
    });

    it("does nothing without START_DATE", async () => {
      await mkUser();
      const { sender, sent } = fakeSender();
      const r = await runReminders({
        db,
        config: buildConfig({ REMINDERS_ENABLED: "true" }),
        sender,
        now: DAY1_0730,
      });
      expect(r).toMatchObject({ mode: "skipped", skipped: "no_start_date" });
      expect(sent).toHaveLength(0);
    });

    it("never announces a day that opened yesterday (reminder time before unlock time)", async () => {
      await mkUser();
      const { sender, sent } = fakeSender();
      const r = await runReminders({
        db,
        config: cfg({ REMINDERS_ENABLED: "true", REMINDER_TIME: "03:00" }),
        sender,
        now: d("2026-12-02T02:00:00Z"), // 04:00 מקומי, עדיין יום 1
      });
      expect(r).toMatchObject({ mode: "skipped", skipped: "day_not_opened_today" });
      expect(sent).toHaveLength(0);
    });

    describe("DST", () => {
      // מעבר לשעון קיץ בישראל: שישי 2027-03-26 ב־02:00. לפניו UTC+2, אחריו UTC+3.
      it("spring forward: 07:30 is 05:30Z the day before and 04:30Z on the change day", async () => {
        await mkUser();
        const { sender, sent } = fakeSender();
        const config = cfg({ REMINDERS_ENABLED: "true", START_DATE: "2027-03-25" });
        expect(
          (await runReminders({ db, config, sender, now: d("2027-03-25T05:29:00Z") })).skipped,
        ).toBe("too_early");
        expect((await runReminders({ db, config, sender, now: d("2027-03-25T05:30:00Z") })).day).toBe(1);
        // יום המעבר: 04:29Z הוא 07:29 מקומי, 04:30Z הוא 07:30.
        expect(
          (await runReminders({ db, config, sender, now: d("2027-03-26T04:29:00Z") })).skipped,
        ).toBe("too_early");
        const r = await runReminders({ db, config, sender, now: d("2027-03-26T04:30:00Z") });
        expect(r).toMatchObject({ day: 2, claimed: 1 });
        expect(sent).toHaveLength(2);
        expect(
          rowsOf<{ date: string }>(await db.execute(sql`select date::text from reminder_log order by date`)).map((x) => x.date),
        ).toEqual(["2027-03-25", "2027-03-26"]);
      });

      it("spring forward: the cutoff also follows local time (12:00 is 09:00Z)", async () => {
        await mkUser();
        const { sender } = fakeSender();
        const config = cfg({ REMINDERS_ENABLED: "true", START_DATE: "2027-03-25" });
        expect((await runReminders({ db, config, sender, now: d("2027-03-26T09:00:00Z") })).skipped).toBe("past_cutoff");
        expect((await runReminders({ db, config, sender, now: d("2027-03-26T08:59:00Z") })).claimed).toBe(1);
      });

      // חזרה לשעון חורף: ראשון 2026-10-25 ב־02:00 (UTC+3 הופך ל־UTC+2).
      it("fall back: 07:30 local is 05:30Z on the change day (04:30Z is only 06:30)", async () => {
        await mkUser();
        const { sender, sent } = fakeSender();
        const config = cfg({ REMINDERS_ENABLED: "true", START_DATE: "2026-10-24" });
        expect(
          (await runReminders({ db, config, sender, now: d("2026-10-24T04:30:00Z") })).day,
        ).toBe(1); // עדיין שעון קיץ
        expect(
          (await runReminders({ db, config, sender, now: d("2026-10-25T04:30:00Z") })).skipped,
        ).toBe("too_early");
        expect((await runReminders({ db, config, sender, now: d("2026-10-25T05:30:00Z") })).day).toBe(2);
        expect(sent).toHaveLength(2);
      });
    });

    describe("message text", () => {
      it("normal day uses the habit; live day uses the configured time; missing time falls back to generic", async () => {
        await mkUser();
        const { sender, sent } = fakeSender();
        await runReminders({ db, config: live(), sender, now: DAY1_0730 });
        expect(JSON.parse(sent[0].payload).body).toContain("הרגל להיום");

        await db.execute(sql`delete from reminder_log`);
        const withTime = cfg({ REMINDERS_ENABLED: "true", LIVE_TIME_DAY7: "20:00" });
        await runReminders({ db, config: withTime, sender, now: d("2026-12-07T05:30:00Z") });
        expect(JSON.parse(sent[1].payload).body).toContain("20:00");

        await db.execute(sql`delete from reminder_log`);
        await runReminders({ db, config: live(), sender, now: d("2026-12-07T05:30:00Z") });
        const body = JSON.parse(sent[2].payload).body as string;
        expect(body).not.toContain("מפגש לייב");
        expect(body).toContain("יום 7");
      });
    });

    describe("push service responses", () => {
      it("410 and 404 delete only the dead subscription; the user still counts as sent", async () => {
        const u = await mkUser({ subs: 3 });
        const subs = await db.select().from(pushSubscriptions);
        const [gone410, gone404, good] = subs.map((s) => s.endpoint);
        const { sender } = fakeSender((s) =>
          s.endpoint === gone410
            ? { ok: false, gone: true, statusCode: 410 }
            : s.endpoint === gone404
              ? { ok: false, gone: true, statusCode: 404 }
              : { ok: true },
        );
        const r = await runReminders({ db, config: live(), sender, now: DAY1_0730 });
        expect(r).toMatchObject({ sent: 1, failed: 0, removedSubscriptions: 2 });
        const left = await db.select().from(pushSubscriptions);
        expect(left.map((s) => s.endpoint)).toEqual([good]);
        const [log] = await db.select().from(schema.reminderLog);
        expect(log).toMatchObject({ userId: u.id, status: "sent" });
      });

      it("all subscriptions gone: log is failed and the subscriptions are deleted", async () => {
        await mkUser({ subs: 2 });
        const { sender } = fakeSender(() => ({ ok: false, gone: true, statusCode: 410 }));
        const r = await runReminders({ db, config: live(), sender, now: DAY1_0730 });
        expect(r).toMatchObject({ sent: 0, failed: 1, removedSubscriptions: 2 });
        expect(await count("push_subscriptions")).toBe(0);
        expect((await db.select().from(schema.reminderLog))[0].status).toBe("failed");
      });

      it("transient errors (5xx or a throw) keep the subscription and are not retried the same day", async () => {
        await mkUser();
        let calls = 0;
        const sender: PushSender = {
          dryRun: false,
          async send() {
            calls++;
            if (calls === 1) throw new Error("network");
            return { ok: false, gone: false, statusCode: 503 };
          },
        };
        const r = await runReminders({ db, config: live(), sender, now: DAY1_0730 });
        expect(r).toMatchObject({ failed: 1, removedSubscriptions: 0 });
        expect(await count("push_subscriptions")).toBe(1);
        await runReminders({ db, config: live(), sender, now: d("2026-12-01T06:00:00Z") });
        expect(calls).toBe(1);
      });
    });
  });

  describe("sync outbox", () => {
    const rowsOut = () => db.select().from(schema.syncOutbox);
    const makeDue = () => db.execute(sql`update sync_outbox set next_attempt_at = now() - interval '1 second'`);

    it("enqueue builds a minimal payload and dedupes", async () => {
      const u = await mkUser();
      expect(await enqueueTrackerSync(db, { userId: u.id, day: 1 })).toBe(true);
      expect(await enqueueTrackerSync(db, { userId: u.id, day: 1 })).toBe(false);
      expect(await enqueueTrackerSync(db, { userId: u.id, day: 2 })).toBe(true);
      const rows = await rowsOut();
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.dedupeKey).sort()).toEqual([`tracker:${u.id}:1`, `tracker:${u.id}:2`]);
    });

    it("payload reflects counted days, completion and live attendance, and contains no PII", async () => {
      const u = await mkUser({ phone: "0521234567" });
      await db.execute(
        sql`insert into action_completions (user_id, day, action) values
            (${u.id}, 1, 'habit'), (${u.id}, 2, 'move'), (${u.id}, 3, 'meditate'), (${u.id}, 7, 'live')`,
      );
      await enqueueTrackerSync(db, { userId: u.id, day: 7 });
      const [row] = await rowsOut();
      expect(row.payload).toEqual({
        ghl_contact_id: u.ghlContactId,
        day: 7,
        counted_days: 4,
        completed: false,
        live_attendance: { day7: true, day14: null },
      });
      const text = JSON.stringify(row.payload) + JSON.stringify(row);
      for (const pii of [u.displayName, "Dana", u.email, "example.test", "0521234567", u.username]) {
        expect(text).not.toContain(pii);
      }
      expect(Object.keys(row.payload as object).sort()).toEqual(
        ["completed", "counted_days", "day", "ghl_contact_id", "live_attendance"],
      );
    });

    it("live attendance comes from action_completions only: day 14 true, unmarked stays null, un-marking returns to null", async () => {
      const u = await mkUser();
      await db.execute(sql`insert into action_completions (user_id, day, action) values (${u.id}, 14, 'live')`);
      await enqueueTrackerSync(db, { userId: u.id, day: 14 });
      expect((await rowsOut())[0].payload).toMatchObject({ live_attendance: { day7: null, day14: true } });
      await db.execute(sql`delete from action_completions where user_id = ${u.id} and action = 'live'`);
      await enqueueTrackerSync(db, { userId: u.id, day: 14 });
      expect((await rowsOut())[0].payload).toMatchObject({ live_attendance: { day7: null, day14: null } });
    });

    it("12 counted days marks completed", async () => {
      const u = await mkUser();
      for (let day = 1; day <= 12; day++) {
        await db.execute(sql`insert into action_completions (user_id, day, action) values (${u.id}, ${day}, 'habit')`);
      }
      await enqueueTrackerSync(db, { userId: u.id, day: 12 });
      expect((await rowsOut())[0].payload).toMatchObject({ counted_days: 12, completed: true });
    });

    it("users without a ghl_contact_id are not enqueued", async () => {
      const u = await mkUser({ ghl: null });
      expect(await enqueueTrackerSync(db, { userId: u.id, day: 1 })).toBe(false);
      expect(await count("sync_outbox")).toBe(0);
    });

    it("a changed state requeues the same row (latest state wins)", async () => {
      const u = await mkUser();
      await enqueueTrackerSync(db, { userId: u.id, day: 1 });
      const [claimed] = await claimDue(db);
      await markFailed(db, claimed, "x", { random: () => 0 });
      await db.execute(sql`insert into action_completions (user_id, day, action) values (${u.id}, 1, 'habit')`);
      expect(await enqueueTrackerSync(db, { userId: u.id, day: 1 })).toBe(true);
      const rows = await rowsOut();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status: "pending", attempts: 0, lastError: null });
      expect(rows[0].payload).toMatchObject({ counted_days: 1 });
    });

    it("worker sends via the mock adapter and marks rows sent", async () => {
      const u = await mkUser();
      await enqueueTrackerSync(db, { userId: u.id, day: 1 });
      const adapter = createMockSyncAdapter();
      const r = await runSyncWorker({ db, enabled: true, adapter });
      expect(r).toMatchObject({ claimed: 1, sent: 1, failed: 0, dead: 0 });
      expect(adapter.calls).toHaveLength(1);
      expect(adapter.calls[0].payload.ghl_contact_id).toBe(u.ghlContactId);
      expect((await rowsOut())[0]).toMatchObject({ status: "sent", attempts: 1 });
      expect((await runSyncWorker({ db, enabled: true, adapter })).claimed).toBe(0);
      expect(adapter.calls).toHaveLength(1);
    });

    it("failure backs off exponentially with jitter and is not claimed again until due", async () => {
      const u = await mkUser();
      await enqueueTrackerSync(db, { userId: u.id, day: 1 });
      const adapter = createMockSyncAdapter();
      const fail = { ok: false, retryable: true, error: "HTTP 503" } as const;
      adapter.queueResults(fail, fail, fail);
      const delays: number[] = [];
      for (let attempt = 1; attempt <= 3; attempt++) {
        const r = await runSyncWorker({ db, enabled: true, adapter, random: () => 0 });
        expect(r).toMatchObject({ claimed: 1, failed: 1 });
        const [row] = await rowsOut();
        expect(row).toMatchObject({ status: "failed", attempts: attempt, lastError: "HTTP 503" });
        const secs = rowsOf<{ s: number }>(
          await db.execute(sql`select extract(epoch from (next_attempt_at - now()))::float as s from sync_outbox`),
        )[0].s;
        delays.push(Math.round(secs));
        // עדיין לא הגיע זמנו
        expect((await runSyncWorker({ db, enabled: true, adapter })).claimed).toBe(0);
        await makeDue();
      }
      // 60, 120, 240 (פחות כמה אלפיות שנייה של ביצוע)
      expect(delays[0]).toBeGreaterThan(55);
      expect(delays[0]).toBeLessThanOrEqual(60);
      expect(delays[1]).toBeGreaterThan(115);
      expect(delays[1]).toBeLessThanOrEqual(120);
      expect(delays[2]).toBeGreaterThan(235);
      expect(delays[2]).toBeLessThanOrEqual(240);
    });

    it("becomes dead after max attempts; a non-retryable error is dead at once", async () => {
      const u = await mkUser();
      await enqueueTrackerSync(db, { userId: u.id, day: 1 });
      const adapter = createMockSyncAdapter();
      const fail = { ok: false, retryable: true, error: "HTTP 500" } as const;
      adapter.queueResults(...Array.from({ length: 20 }, () => fail));
      let last = { dead: 0 };
      for (let i = 0; i < 8; i++) {
        last = await runSyncWorker({ db, enabled: true, adapter });
        await makeDue();
      }
      expect(last.dead).toBe(1);
      expect((await rowsOut())[0]).toMatchObject({ status: "dead", attempts: 8 });
      expect((await runSyncWorker({ db, enabled: true, adapter })).claimed).toBe(0);

      const u2 = await mkUser();
      await enqueueTrackerSync(db, { userId: u2.id, day: 1 });
      const a2 = createMockSyncAdapter();
      a2.queueResults({ ok: false, retryable: false, error: "HTTP 400" });
      const r = await runSyncWorker({ db, enabled: true, adapter: a2 });
      expect(r.dead).toBe(1);
    });

    it("an adapter that throws is a retryable failure, and last_error is redacted and truncated", async () => {
      const u = await mkUser();
      await enqueueTrackerSync(db, { userId: u.id, day: 1 });
      const adapter = {
        name: "boom",
        async send(): Promise<never> {
          throw new Error(
            `POST https://hooks.example/secret failed for ${u.email} ${u.phone} Bearer abc.def ${"z".repeat(1000)}`,
          );
        },
      };
      const r = await runSyncWorker({ db, enabled: true, adapter });
      expect(r.failed).toBe(1);
      const [row] = await rowsOut();
      expect(row.status).toBe("failed");
      const err = row.lastError ?? "";
      expect(err.length).toBeLessThanOrEqual(300);
      for (const leak of ["hooks.example", "secret", u.email, "052-123", "abc.def"]) {
        expect(err).not.toContain(leak);
      }
    });

    it("a stale result does not clobber a newer state (payload changed while in flight)", async () => {
      const u = await mkUser();
      await enqueueTrackerSync(db, { userId: u.id, day: 1 });
      const [claimed] = await claimDue(db);
      await db.execute(sql`insert into action_completions (user_id, day, action) values (${u.id}, 1, 'habit')`);
      await enqueueTrackerSync(db, { userId: u.id, day: 1 });
      expect(await markSent(db, claimed)).toBe(false);
      expect(await markFailed(db, claimed, "late")).toBeNull();
      expect((await rowsOut())[0]).toMatchObject({ status: "pending", attempts: 0 });
    });

    it("a stale failure cannot clobber a newer claim that already succeeded (attempts reset by enqueue)", async () => {
      const u = await mkUser();
      await enqueueTrackerSync(db, { userId: u.id, day: 1 });
      const [a] = await claimDue(db); // עובד A, attempts=1
      await db.execute(sql`insert into action_completions (user_id, day, action) values (${u.id}, 1, 'habit')`);
      await enqueueTrackerSync(db, { userId: u.id, day: 1 }); // attempts חוזר ל־0, זמין מיד
      const [b] = await claimDue(db); // עובד B, שוב attempts=1
      expect(b.attempts).toBe(a.attempts);
      expect(await markSent(db, b)).toBe(true);
      expect(await markFailed(db, a, "late", { retryable: false })).toBeNull();
      expect(await markFailed(db, b, "dup")).toBeNull(); // גם תוצאה כפולה של B לא משנה שורה שנשלחה
      expect((await rowsOut())[0]).toMatchObject({ status: "sent", lastError: null });
    });

    it("claimDue: concurrent claims never return the same row (SKIP LOCKED + lease)", async () => {
      for (let i = 0; i < 10; i++) {
        const u = await mkUser();
        await enqueueTrackerSync(db, { userId: u.id, day: 1 });
      }
      const batches = await Promise.all(Array.from({ length: 5 }, () => claimDue(db, 3)));
      const ids = batches.flat().map((r) => r.id);
      expect(ids).toHaveLength(10);
      expect(new Set(ids).size).toBe(10);
      expect(batches.flat().every((r) => r.attempts === 1)).toBe(true);
      expect(await claimDue(db, 10)).toHaveLength(0);
    });

    it("claimDue skips rows locked by another transaction instead of waiting", async () => {
      for (let i = 0; i < 4; i++) {
        const u = await mkUser();
        await enqueueTrackerSync(db, { userId: u.id, day: 1 });
      }
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      let locked: string[] = [];
      let lockedReady!: () => void;
      const ready = new Promise<void>((r) => (lockedReady = r));
      const holder = db.transaction(async (tx) => {
        const res = await tx.execute(
          sql`select id from sync_outbox order by created_at limit 2 for update`,
        );
        locked = rowsOf<{ id: string }>(res).map((r) => r.id);
        lockedReady();
        await gate;
      });
      await ready;
      const t0 = Date.now();
      const claimed = await claimDue(db, 10);
      expect(Date.now() - t0).toBeLessThan(2000); // לא חיכה לנעילה
      expect(claimed).toHaveLength(2);
      expect(claimed.some((c) => locked.includes(c.id))).toBe(false);
      release();
      await holder;
    });

    it("an expired lease makes a crashed claim claimable again", async () => {
      const u = await mkUser();
      await enqueueTrackerSync(db, { userId: u.id, day: 1 });
      expect(await claimDue(db)).toHaveLength(1);
      expect(await claimDue(db)).toHaveLength(0);
      await makeDue();
      const again = await claimDue(db);
      expect(again).toHaveLength(1);
      expect(again[0].attempts).toBe(2);
    });
  });

  describe("cleanup", () => {
    it("purges by retention and keeps recent data", async () => {
      const u = await mkUser();
      await db.execute(sql`insert into webhook_events (event_id, received_at) values
        ('old', now() - interval '31 days'), ('new', now() - interval '1 day')`);
      await db.execute(sql`insert into login_attempts (kind, identifier_hash, attempted_at) values
        ('login', 'h', now() - interval '2 days'), ('login', 'h2', now())`);
      await db.execute(sql`insert into sessions (user_id, token_hash, expires_at) values
        (${u.id}, 't1', now() - interval '1 hour'), (${u.id}, 't2', now() + interval '1 day')`);
      await db.execute(sql`insert into sync_outbox (user_id, kind, dedupe_key, status, created_at, next_attempt_at) values
        (${u.id}, 'tracker', 'a', 'sent', now() - interval '15 days', now() - interval '15 days'),
        (${u.id}, 'tracker', 'b', 'sent', now() - interval '1 day', now() - interval '1 day'),
        (${u.id}, 'tracker', 'c', 'dead', now() - interval '91 days', now() - interval '91 days'),
        (${u.id}, 'tracker', 'd', 'dead', now() - interval '30 days', now() - interval '30 days'),
        (${u.id}, 'tracker', 'e', 'pending', now() - interval '400 days', now() - interval '400 days'),
        (${u.id}, 'tracker', 'f', 'sent', now() - interval '400 days', now() - interval '1 hour'),
        (${u.id}, 'tracker', 'g', 'dead', now() - interval '400 days', now() - interval '1 hour')`);
      await db.execute(sql`insert into reminder_log (user_id, date, status, created_at) values
        (${u.id}, '2026-01-01', 'sent', now() - interval '91 days'),
        (${u.id}, '2026-01-02', 'sent', now())`);
      const r = await runCleanup(db);
      expect(r).toEqual({
        sessions: 1,
        activationTokens: 0,
        loginAttempts: 1,
        webhookEvents: 1,
        syncSent: 1,
        syncDead: 1,
        reminderLog: 1,
      });
      expect(await count("webhook_events")).toBe(1);
      expect(await count("sessions")).toBe(1);
      // f, g: נוצרו מזמן אבל טופלו עכשיו (חזרו לתור); נשמרים לפי הפעילות האחרונה.
      expect(await count("sync_outbox")).toBe(5);
      expect(await count("reminder_log")).toBe(1);
      expect(await purgeExpired(db)).toEqual({ sessions: 0, activationTokens: 0, loginAttempts: 0 });
    });
  });

  describe("cron routes with a database", () => {
    const SECRET = "r".repeat(24);
    const authed = new Request("http://localhost/api/cron/x", { headers: { authorization: `Bearer ${SECRET}` } });
    let saved: string | undefined;
    beforeEach(() => {
      saved = process.env.CRON_SECRET;
      process.env.CRON_SECRET = SECRET;
    });
    afterEach(() => {
      if (saved === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = saved;
    });

    it("cleanup returns counts only", async () => {
      const res = await cleanupGET(authed);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const body = (await res.json()) as Record<string, unknown>;
      expect(Object.values(body).every((v) => typeof v === "number")).toBe(true);
    });

    it("reminders under the default env: 200, skipped, nothing sent", async () => {
      await mkUser();
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const res = await remindersGET(authed);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { mode: string; sent: number };
      expect(body.sent).toBe(0);
      expect(["skipped", "dry"]).toContain(body.mode);
      expect(webPushSend).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
