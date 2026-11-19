import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { REMINDERS } from "@/config/constants";
import { rowsOf } from "@/lib/auth/sql";
import { logger, type Logger } from "@/lib/logger";
import type { GhlConfig } from "./config";
import { eveningDedupeKey, GHL_EVENING_REMINDER_KIND } from "./outbox";

export type GhlEveningReminderResult = { mode: "dry" | "live"; claimed: number };

/**
 * תזכורת הערב דרך GHL: לכל משתתף מופעל עם ghl_contact_id שלא כיבה את תזכורת הוואטסאפ ולא הושבת, שורה אחת ב־reminder_log
 * (channel evening_ghl) לתאריך המקומי, ובמצב live גם שורת outbox (באותה טרנזקציה). השעה וה־cutoff נבדקים בקורא.
 * הגרסה (open / done / last) לא נקבעת כאן אלא ב־outbox בשליחה. מצב: cfg.eveningMode (ראו combineEveningMode); null כש־off.
 */
export async function queueGhlEveningReminders(args: {
  db: Db;
  cfg: GhlConfig;
  date: string;
  day: number;
  log?: Logger;
  claimBatchSize?: number;
  runBudgetMs?: number;
}): Promise<GhlEveningReminderResult | null> {
  const { db, cfg, date, day } = args;
  const log = args.log ?? logger;
  if (cfg.eveningMode === "off") return null;
  const live = cfg.eveningMode === "live";
  const initial = live ? "pending" : "dry_run";
  const batch = args.claimBatchSize ?? REMINDERS.claimBatchSize;
  const budget = args.runBudgetMs ?? REMINDERS.runBudgetMs;
  const started = Date.now();
  const payload = JSON.stringify({ date, day });
  let claimed = 0;

  for (;;) {
    const ids = await db.transaction(async (tx) => {
      const got = rowsOf<{ user_id: string }>(
        await tx.execute(
          sql`insert into reminder_log (user_id, date, channel, status)
              select u.id, ${date}::date, 'evening_ghl', ${initial}
                from users u
               where u.password_hash is not null and u.activated_at is not null and u.ghl_contact_id is not null and u.disabled_at is null
                 and u.whatsapp_reminders
                 and not exists (select 1 from reminder_log r where r.user_id = u.id and r.date = ${date}::date and r.channel = 'evening_ghl')
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
                values (${id}, ${GHL_EVENING_REMINDER_KIND}, ${eveningDedupeKey(id, date)}, ${payload}::jsonb)
                on conflict (dedupe_key) do nothing`,
          );
        }
      }
      return got;
    });
    claimed += ids.length;
    if (!live) for (const id of ids) log.info("ghl evening reminder dry-run (not sent)", { userId: id, day });
    if (ids.length < batch || Date.now() - started >= budget) break;
  }
  log.info("ghl evening reminders queued", { mode: cfg.eveningMode, claimed, day });
  return { mode: cfg.eveningMode, claimed };
}
