import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { REMINDERS } from "@/config/constants";
import { rowsOf } from "@/lib/auth/sql";
import { logger, type Logger } from "@/lib/logger";
import type { DueLiveReminder } from "@/lib/live/reminder";
import type { GhlConfig } from "./config";
import { GHL_LIVE_REMINDER_KIND, liveReminderDedupeKey } from "./outbox";

export type GhlLiveReminderResult = { mode: "dry" | "live"; claimed: number };

/**
 * תזכורת הלייב דרך GHL (תג נפרד מתגי התזכורת היומית, ללא קשר לשעת הבחירה של המשתתף): לכל משתתף מופעל עם
 * ghl_contact_id שלא כיבה את תזכורת הוואטסאפ ולא הושבת, שורה אחת ב־reminder_log (channel live_ghl) לתאריך יום הלייב,
 * ובמצב live גם שורת outbox (באותה טרנזקציה). דגל GHL_REMINDER_MODE זהה לתזכורת היומית. null כשהוא off.
 */
export async function queueGhlLiveReminders(args: {
  db: Db;
  cfg: GhlConfig;
  due: DueLiveReminder;
  log?: Logger;
  claimBatchSize?: number;
  runBudgetMs?: number;
}): Promise<GhlLiveReminderResult | null> {
  const { db, cfg, due } = args;
  const log = args.log ?? logger;
  if (cfg.reminderMode === "off") return null;
  const live = cfg.reminderMode === "live";
  const initial = live ? "pending" : "dry_run";
  const batch = args.claimBatchSize ?? REMINDERS.claimBatchSize;
  const budget = args.runBudgetMs ?? REMINDERS.runBudgetMs;
  const started = Date.now();
  const payload = JSON.stringify({ date: due.date, day: due.day, time: due.time, startsAt: due.startsAt.toISOString() });
  let claimed = 0;

  for (;;) {
    const ids = await db.transaction(async (tx) => {
      const got = rowsOf<{ user_id: string }>(
        await tx.execute(
          sql`insert into reminder_log (user_id, date, channel, status)
              select u.id, ${due.date}::date, 'live_ghl', ${initial}
                from users u
               where u.password_hash is not null and u.activated_at is not null and u.ghl_contact_id is not null and u.disabled_at is null
                 and u.whatsapp_reminders
                 and not exists (select 1 from reminder_log r where r.user_id = u.id and r.date = ${due.date}::date and r.channel = 'live_ghl')
               order by u.id
               limit ${batch}
              on conflict (user_id, date, channel) do nothing
              returning user_id`,
        ),
      ).map((r) => r.user_id);
      if (live) {
        for (const id of got) {
          await tx.execute(
            sql`insert into sync_outbox (user_id, kind, dedupe_key, payload)
                values (${id}, ${GHL_LIVE_REMINDER_KIND}, ${liveReminderDedupeKey(id, due.date)}, ${payload}::jsonb)
                on conflict (dedupe_key) do nothing`,
          );
        }
      }
      return got;
    });
    claimed += ids.length;
    if (!live) for (const id of ids) log.info("ghl live reminder dry-run (not sent)", { userId: id, day: due.day, tag: cfg.tags.liveReminder });
    if (ids.length < batch || Date.now() - started >= budget) break;
  }
  log.info("ghl live reminders queued", { mode: cfg.reminderMode, claimed, day: due.day });
  return { mode: cfg.reminderMode, claimed };
}
