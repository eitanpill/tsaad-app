import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { REMINDERS } from "@/config/constants";
import type { AppConfig } from "@/config";
import { rowsOf } from "@/lib/auth/sql";
import { makeSchedule } from "@/lib/days";
import { dueLiveReminders } from "@/lib/live/reminder";
import { logger, type Logger } from "@/lib/logger";
import { getGhlConfig, type GhlConfig } from "@/lib/ghl/config";
import { queueGhlLiveReminders, type GhlLiveReminderResult } from "@/lib/ghl/live-reminders";
import { buildLiveReminderMessage } from "./message";
import { sendPushBatch } from "./reminders";
import type { PushSender } from "./sender";

export type LiveReminderRunResult = {
  /** dry: REMINDERS_ENABLED כבוי; live: שליחה אמיתית; skipped: אין עכשיו מפגש בחלון. */
  mode: "dry" | "live" | "skipped";
  skipped?: "no_start_date" | "no_live_in_window" | "no_vapid";
  day?: number;
  claimed: number;
  sent: number;
  failed: number;
  removedSubscriptions: number;
  ghl?: GhlLiveReminderResult;
};

/**
 * תזכורת הלייב, נפרדת מהיומית: ביום לייב (7 ו־14) בלבד, פעם אחת לכל משתתף מופעל, בריצה הראשונה בטווח
 * [התחלה פחות LIVE_REMINDER.leadMinutes, התחלה). ריצה שמאחרת אל אחרי ההתחלה לא שולחת. בלי שעה מוגדרת (LIVE_TIME_DAYn)
 * לא נשלח דבר. ה־cron רץ כל 15 דקות, ולכן ההודעה מגיעה 45 עד 60 דקות לפני.
 *
 * אותה הגנה מכפילות כמו ביומית: שורת reminder_log (channel live_push / live_ghl, התאריך הוא תאריך יום הלייב)
 * נכנסת קודם ב־ON CONFLICT DO NOTHING, ורק מי ש"זכה" בה שולח. אין תלות בשעת התזכורת היומית של המשתתף.
 * כבוד לאותם ערוצים והסרות: מנוי push קיים; לוואטסאפ ghl_contact_id ו־whatsapp_reminders; מושבתים לא מקבלים.
 * REMINDERS_ENABLED כבוי: שורות dry_run ולא נקרא ה־sender (כמו ביומית); GHL_REMINDER_MODE כמו ביומית.
 */
export async function runLiveReminders(args: {
  db: Db;
  config: AppConfig;
  sender: PushSender;
  now?: Date;
  log?: Logger;
  claimBatchSize?: number;
  runBudgetMs?: number;
  ghlConfig?: GhlConfig;
}): Promise<LiveReminderRunResult> {
  const { db, config, sender } = args;
  const log = args.log ?? logger;
  const now = args.now ?? new Date();
  const base: LiveReminderRunResult = { mode: "skipped", claimed: 0, sent: 0, failed: 0, removedSubscriptions: 0 };

  if (!config.startDate) return { ...base, skipped: "no_start_date" };
  const schedule = makeSchedule(config.startDate, { timeZone: config.timeZone, unlockTime: config.unlockTime });
  const due = dueLiveReminders(now, schedule, {
    7: { time: config.env.LIVE_TIME_DAY7 },
    14: { time: config.env.LIVE_TIME_DAY14 },
  })[0];
  if (!due) return { ...base, skipped: "no_live_in_window" };

  const ghl = await queueGhlLiveReminders({
    db,
    cfg: args.ghlConfig ?? getGhlConfig(config.env),
    due,
    log,
    claimBatchSize: args.claimBatchSize,
    runBudgetMs: args.runBudgetMs,
  });
  const withGhl = <T extends LiveReminderRunResult>(r: T): T => (ghl ? { ...r, ghl } : r);

  const enabled = config.env.REMINDERS_ENABLED === true;
  if (enabled && sender.dryRun) {
    log.warn("live reminders enabled but push sender is not configured; nothing done");
    return withGhl({ ...base, skipped: "no_vapid", day: due.day });
  }
  const initial = enabled ? "pending" : "dry_run";
  const result: LiveReminderRunResult = { ...base, mode: enabled ? "live" : "dry", day: due.day };
  const payload = JSON.stringify(buildLiveReminderMessage(due.day));
  const batchSize = args.claimBatchSize ?? REMINDERS.claimBatchSize;
  const budgetMs = args.runBudgetMs ?? REMINDERS.runBudgetMs;
  const startedAt = Date.now();

  for (;;) {
    const claimed = rowsOf<{ user_id: string }>(
      await db.execute(
        sql`insert into reminder_log (user_id, date, channel, status)
            select u.id, ${due.date}::date, 'live_push', ${initial}
              from users u
             where u.password_hash is not null and u.activated_at is not null and u.disabled_at is null
               and exists (select 1 from push_subscriptions p where p.user_id = u.id)
               and not exists (select 1 from reminder_log r where r.user_id = u.id and r.date = ${due.date}::date and r.channel = 'live_push')
             order by u.id
             limit ${batchSize}
            on conflict (user_id, date, channel) do nothing
            returning user_id`,
      ),
    ).map((r) => r.user_id);
    result.claimed += claimed.length;
    if (claimed.length === 0) break;
    if (enabled) {
      const r = await sendPushBatch({ db, sender, claimed, payload, date: due.date, channel: "live_push" });
      result.sent += r.sent;
      result.failed += r.failed;
      result.removedSubscriptions += r.removedSubscriptions;
    }
    if (claimed.length < batchSize || Date.now() - startedAt >= budgetMs) break;
  }
  log.info("live reminders run", { ...result });
  return withGhl(result);
}
