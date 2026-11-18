import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { REMINDERS } from "@/config/constants";
import type { AppConfig } from "@/config";
import { rowsOf } from "@/lib/auth/sql";
import { makeSchedule } from "@/lib/days";
import { eveningContent, type EveningContent } from "@/lib/evening/content";
import { eveningDay, eveningDueMinutes, eveningDueNow } from "@/lib/evening/timing";
import { logger, type Logger } from "@/lib/logger";
import { localDate, localMinutes } from "@/lib/time/zone";
import { getGhlConfig, type GhlConfig } from "@/lib/ghl/config";
import { queueGhlEveningReminders, type GhlEveningReminderResult } from "@/lib/ghl/evening-reminders";
import { buildEveningReminderMessage } from "./message";
import { sendPushBatch } from "./reminders";
import type { PushSender } from "./sender";

export type EveningReminderRunResult = {
  /** dry: REMINDERS_ENABLED כבוי או EVENING_REMINDERS_MODE הוא dry; live: שליחה אמיתית; skipped: לא עכשיו. */
  mode: "dry" | "live" | "skipped";
  skipped?: "off" | "no_start_date" | "out_of_range" | "not_due" | "no_vapid";
  day?: number;
  claimed: number;
  sent: number;
  failed: number;
  removedSubscriptions: number;
  ghl?: GhlEveningReminderResult;
};

const idList = (ids: string[]) => sql.join(ids.map((i) => sql`${i}`), sql`, `);

/**
 * תזכורת הערב, נפרדת מהיומית ומהלייב: מיום 0 (הערב שלפני START_DATE) עד יום 14, פעם אחת לכל משתתף לתאריך מקומי, בריצה הראשונה
 * מ־EVENING_REMINDER_TIME (ביום לייב שחופף לשעה: אחרי סוף המפגש, ראו eveningDueMinutes) ועד ה־cutoff (EVENING.cutoffMinutes).
 * EVENING_REMINDERS_MODE כבוי (ברירת מחדל): לא נעשה דבר. הערוץ ב־GHL עצמאי (ראו queueGhlEveningReminders).
 * התראה: מנוי push קיים; שורה ב־reminder_log (evening_push) נכנסת קודם ב־ON CONFLICT DO NOTHING, כמו בשאר התזכורות.
 * שליחה אמיתית רק כש־EVENING_REMINDERS_MODE הוא live וגם REMINDERS_ENABLED; אחרת שורות dry_run ובלי קריאה ל־sender.
 * הגרסה (open / done / last) נקבעת לכל משתמש לפי action_completions של היום; מקבצים לפי גרסה ושולחים מטען אחד לכל קבוצה.
 * יום 14 שהושלם: לא נשלח דבר והשורה נסגרת כ־sent.
 */
export async function runEveningReminders(args: {
  db: Db;
  config: AppConfig;
  sender: PushSender;
  now?: Date;
  log?: Logger;
  claimBatchSize?: number;
  runBudgetMs?: number;
  ghlConfig?: GhlConfig;
}): Promise<EveningReminderRunResult> {
  const { db, config, sender } = args;
  const log = args.log ?? logger;
  const now = args.now ?? new Date();
  const base: EveningReminderRunResult = { mode: "skipped", claimed: 0, sent: 0, failed: 0, removedSubscriptions: 0 };
  const skip = (reason: NonNullable<EveningReminderRunResult["skipped"]>, day?: number): EveningReminderRunResult => ({ ...base, skipped: reason, day });

  const evening = config.env.EVENING_REMINDERS_MODE;
  if (evening === "off") return skip("off");
  if (!config.startDate) return skip("no_start_date");
  const schedule = makeSchedule(config.startDate, { timeZone: config.timeZone, unlockTime: config.unlockTime });
  const day = eveningDay(now, schedule);
  if (day === null) return skip("out_of_range");

  const liveTime = ({ 0: config.env.LIVE_TIME_DAY0, 7: config.env.LIVE_TIME_DAY7, 14: config.env.LIVE_TIME_DAY14 } as Record<number, string | undefined>)[day];
  const dueAt = eveningDueMinutes({ eveningTime: config.env.EVENING_REMINDER_TIME, day, liveTime });
  if (!eveningDueNow(localMinutes(now, config.timeZone), dueAt)) return skip("not_due", day);
  const date = localDate(now, config.timeZone);

  const ghl = await queueGhlEveningReminders({
    db,
    cfg: args.ghlConfig ?? getGhlConfig(config.env),
    date,
    day,
    log,
    claimBatchSize: args.claimBatchSize,
    runBudgetMs: args.runBudgetMs,
  });
  const withGhl = <T extends EveningReminderRunResult>(r: T): T => (ghl ? { ...r, ghl } : r);

  const enabled = evening === "live" && config.env.REMINDERS_ENABLED === true;
  if (enabled && sender.dryRun) {
    log.warn("evening reminders enabled but push sender is not configured; nothing done");
    return withGhl(skip("no_vapid", day));
  }
  const initial = enabled ? "pending" : "dry_run";
  const result: EveningReminderRunResult = { ...base, mode: enabled ? "live" : "dry", day };
  const batchSize = args.claimBatchSize ?? REMINDERS.claimBatchSize;
  const budgetMs = args.runBudgetMs ?? REMINDERS.runBudgetMs;
  const startedAt = Date.now();

  for (;;) {
    const claimed = rowsOf<{ user_id: string }>(
      await db.execute(
        sql`insert into reminder_log (user_id, date, channel, status)
            select u.id, ${date}::date, 'evening_push', ${initial}
              from users u
             where u.password_hash is not null and u.activated_at is not null and u.disabled_at is null
               and exists (select 1 from push_subscriptions p where p.user_id = u.id)
               and not exists (select 1 from reminder_log r where r.user_id = u.id and r.date = ${date}::date and r.channel = 'evening_push')
             order by u.id
             limit ${batchSize}
            on conflict (user_id, date, channel) do nothing
            returning user_id`,
      ),
    ).map((r) => r.user_id);
    result.claimed += claimed.length;
    if (claimed.length === 0) break;
    if (enabled) {
      const r = await sendByVariant({ db, sender, claimed, day, date });
      result.sent += r.sent;
      result.failed += r.failed;
      result.removedSubscriptions += r.removedSubscriptions;
    }
    if (claimed.length < batchSize || Date.now() - startedAt >= budgetMs) break;
  }
  log.info("evening reminders run", { ...result });
  return withGhl(result);
}

/** קובע גרסה לכל משתמש שנתפס לפי השלמת היום, ושולח מטען אחד לכל גרסה. מי שאין לו מה לקבל (יום 14 שהושלם) נסגר כ־sent. */
async function sendByVariant(args: { db: Db; sender: PushSender; claimed: string[]; day: number; date: string }) {
  const { db, sender, claimed, day, date } = args;
  const out = { sent: 0, failed: 0, removedSubscriptions: 0 };
  const completed = new Set(
    day === 0
      ? []
      : rowsOf<{ user_id: string }>(
          await db.execute(sql`select distinct user_id from action_completions where day = ${day} and user_id in (${idList(claimed)})`),
        ).map((r) => r.user_id),
  );
  const groups = new Map<string, { content: EveningContent; ids: string[] }>();
  const nothing: string[] = [];
  for (const id of claimed) {
    const content = eveningContent(day, completed.has(id));
    if (!content) {
      nothing.push(id);
      continue;
    }
    const g = groups.get(content.variant) ?? { content, ids: [] };
    g.ids.push(id);
    groups.set(content.variant, g);
  }
  if (nothing.length > 0) {
    await db.execute(
      sql`update reminder_log set status = 'sent'
          where date = ${date}::date and channel = 'evening_push' and status = 'pending' and user_id in (${idList(nothing)})`,
    );
  }
  for (const g of groups.values()) {
    const payload = JSON.stringify(buildEveningReminderMessage(g.content, day));
    const r = await sendPushBatch({ db, sender, claimed: g.ids, payload, date, channel: "evening_push" });
    out.sent += r.sent;
    out.failed += r.failed;
    out.removedSubscriptions += r.removedSubscriptions;
  }
  return out;
}
