import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { REMINDERS } from "@/config/constants";
import type { AppConfig } from "@/config";
import { rowsOf } from "@/lib/auth/sql";
import { dayDate, dayStatusAt, isDayUnlocked, makeSchedule, reminderDue } from "@/lib/days";
import { localDate } from "@/lib/time/zone";
import { logger, type Logger } from "@/lib/logger";
import { getGhlConfig, type GhlConfig } from "@/lib/ghl/config";
import { queueGhlReminders, type GhlReminderResult } from "@/lib/ghl/reminders";
import { buildReminderMessage } from "./message";
import type { PushSender } from "./sender";

export type ReminderSkip =
  | "no_start_date"
  | "no_active_day"
  | "day_not_opened_today"
  | "too_early"
  | "past_cutoff"
  | "no_vapid";

export type ReminderRunResult = {
  /** dry: REMINDERS_ENABLED כבוי; live: שליחה אמיתית. */
  mode: "dry" | "live" | "skipped";
  skipped?: ReminderSkip;
  day?: number;
  claimed: number;
  sent: number;
  failed: number;
  removedSubscriptions: number;
  /** תזכורת ווטסאפ דרך GHL; מופיע רק כש־GHL_REMINDER_MODE אינו off. */
  ghl?: GhlReminderResult;
};

const idList = (ids: string[]) => sql.join(ids.map((i) => sql`${i}`), sql`, `);

/**
 * תזכורת אחת למשתמש לתאריך מקומי, בריצה הראשונה ב־reminderTime או אחריה ולפני ה־cutoff.
 *
 * הגנה מכפילות: קודם נכנסת שורה ל־reminder_log (ON CONFLICT DO NOTHING על (user, date, channel)),
 * ורק מי ש"זכה" בשורה שולח. ריצות מקבילות לא יכולות לשלוח פעמיים. אם התהליך קורס אחרי
 * הכניסה ולפני השליחה, השורה נשארת pending והמשתמש לא יקבל תזכורת באותו יום (עדיף על כפל).
 *
 * התפיסה בסבבים של REMINDERS.claimBatchSize, ואחרי REMINDERS.runBudgetMs לא נפתח סבב חדש:
 * כך ריצה שנחתכת (timeout של הפונקציה) משאירה pending רק סבב אחד, ולא את כל המשתמשים,
 * והשאר נתפסים בריצה הבאה. לכל משתמש נשלח לעד REMINDERS.maxSubscriptionsPerUser מנויים.
 *
 * dry (REMINDERS_ENABLED כבוי): נכתבות שורות dry_run ולא נקרא ה־sender בכלל.
 * שימו לב: שורת dry_run תופסת את היום, ולכן הדלקת הדגל באמצע יום לא תשלח עד מחר.
 */
export async function runReminders(args: {
  db: Db;
  config: AppConfig;
  sender: PushSender;
  now?: Date;
  log?: Logger;
  /** לבדיקות; ברירת מחדל REMINDERS.claimBatchSize / runBudgetMs. */
  claimBatchSize?: number;
  runBudgetMs?: number;
  /** ברירת מחדל: מהתצורה. */
  ghlConfig?: GhlConfig;
}): Promise<ReminderRunResult> {
  const { db, config, sender } = args;
  const log = args.log ?? logger;
  const now = args.now ?? new Date();
  const base: ReminderRunResult = {
    mode: "skipped",
    claimed: 0,
    sent: 0,
    failed: 0,
    removedSubscriptions: 0,
  };
  const skip = (reason: ReminderSkip, day?: number): ReminderRunResult => ({ ...base, skipped: reason, day });

  if (!config.startDate) return skip("no_start_date");
  const schedule = makeSchedule(config.startDate, {
    timeZone: config.timeZone,
    unlockTime: config.unlockTime,
  });
  const status = dayStatusAt(now, schedule);
  if (status.phase !== "active") return skip("no_active_day");
  const day = status.day;
  if (!isDayUnlocked(day, now, schedule)) return skip("no_active_day", day);
  // ההודעה אומרת "יום N נפתח": רק אם היום הזה נפתח בתאריך המקומי של היום.
  if (dayDate(day, schedule) !== localDate(now, config.timeZone)) return skip("day_not_opened_today", day);

  const due = reminderDue({
    now,
    timeZone: config.timeZone,
    reminderTime: config.reminderTime,
    alreadyHandledDates: [],
    cutoffTime: REMINDERS.cutoffTime,
  });
  if (!due.due) return skip(due.reason === "past_cutoff" ? "past_cutoff" : "too_early", day);
  const date = due.date;

  // ערוץ ה־GHL (ווטסאפ) בלתי תלוי בהתראות הדפדפן (VAPID, מנויים): רץ קודם, ואחריו הלוגיקה הקיימת.
  const ghl = await queueGhlReminders({
    db,
    cfg: args.ghlConfig ?? getGhlConfig(config.env),
    day,
    date,
    log,
    claimBatchSize: args.claimBatchSize,
    runBudgetMs: args.runBudgetMs,
  });
  const withGhl = <T extends ReminderRunResult>(r: T): T => (ghl ? { ...r, ghl } : r);

  const enabled = config.env.REMINDERS_ENABLED === true;
  if (enabled && sender.dryRun) {
    // הדגל דלוק אבל אין מפתחות VAPID: לא תופסים את היום, כדי שלא יאבדו תזכורות.
    log.warn("reminders enabled but push sender is not configured; nothing done");
    return withGhl(skip("no_vapid", day));
  }
  const live = enabled;
  const initial = live ? "pending" : "dry_run";

  const result: ReminderRunResult = { ...base, mode: live ? "live" : "dry", day };
  const message = buildReminderMessage(day, {
    7: config.env.LIVE_TIME_DAY7,
    14: config.env.LIVE_TIME_DAY14,
  });
  const payload = JSON.stringify(message);
  const batchSize = args.claimBatchSize ?? REMINDERS.claimBatchSize;
  const budgetMs = args.runBudgetMs ?? REMINDERS.runBudgetMs;
  const startedAt = Date.now();

  /**
   * תופס עד batchSize משתמשים שעוד אין להם שורה לתאריך הזה. not exists לפני ה־limit,
   * כדי שמשתמשים שכבר טופלו לא "יבזבזו" מקום בסבב; on conflict נשאר המנעול האמיתי מול
   * ריצה מקבילה.
   */
  const claimBatch = async () =>
    rowsOf<{ user_id: string }>(
      await db.execute(
        sql`insert into reminder_log (user_id, date, channel, status)
            select u.id, ${date}::date, 'push', ${initial}
              from users u
             where u.password_hash is not null and u.activated_at is not null
               and exists (select 1 from push_subscriptions p where p.user_id = u.id)
               and not exists (select 1 from reminder_log r where r.user_id = u.id and r.date = ${date}::date and r.channel = 'push')
             order by u.id
             limit ${batchSize}
            on conflict (user_id, date, channel) do nothing
            returning user_id`,
      ),
    ).map((r) => r.user_id);

  const sendBatch = async (claimed: string[]) => {
    // המנויים החדשים ביותר בלבד, עד maxSubscriptionsPerUser לכל משתמש.
    const subs = rowsOf<{ user_id: string; endpoint: string; p256dh: string; auth: string }>(
      await db.execute(
        sql`select user_id, endpoint, p256dh, auth from (
              select user_id, endpoint, p256dh, auth,
                     row_number() over (partition by user_id order by created_at desc, id) as rn
                from push_subscriptions
               where user_id in (${idList(claimed)})
            ) s where rn <= ${REMINDERS.maxSubscriptionsPerUser}`,
      ),
    );
    const byUser = new Map<string, typeof subs>();
    for (const s of subs) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

    const sendForUser = async (userId: string) => {
      let anyOk = false;
      for (const sub of byUser.get(userId) ?? []) {
        let r;
        try {
          r = await sender.send({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload);
        } catch {
          r = { ok: false as const, gone: false };
        }
        if (r.ok) anyOk = true;
        else if (r.gone) {
          await db.execute(
            sql`delete from push_subscriptions where endpoint = ${sub.endpoint} and user_id = ${userId}`,
          );
          result.removedSubscriptions++;
        }
      }
      await db.execute(
        sql`update reminder_log set status = ${anyOk ? "sent" : "failed"}
            where user_id = ${userId} and date = ${date}::date and channel = 'push' and status = 'pending'`,
      );
      if (anyOk) result.sent++;
      else result.failed++;
    };

    for (let i = 0; i < claimed.length; i += REMINDERS.sendConcurrency) {
      await Promise.all(claimed.slice(i, i + REMINDERS.sendConcurrency).map(sendForUser));
    }
  };

  // סבבים עד שאין עוד משתמשים או שנגמר התקציב; השאר ייתפסו בריצה הבאה (לפני ה־cutoff).
  for (;;) {
    const claimed = await claimBatch();
    result.claimed += claimed.length;
    if (claimed.length === 0) break;
    if (live) await sendBatch(claimed);
    if (claimed.length < batchSize || Date.now() - startedAt >= budgetMs) break;
  }
  log.info("reminders run", { ...result });
  return withGhl(result);
}
