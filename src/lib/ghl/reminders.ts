import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { REMINDERS } from "@/config/constants";
import { rowsOf } from "@/lib/auth/sql";
import { logger, type Logger } from "@/lib/logger";
import type { GhlConfig } from "./config";
import { GHL_REMINDER_KIND, reminderDedupeKey } from "./outbox";

export type GhlReminderResult = { mode: "dry" | "live"; claimed: number };

/**
 * תזכורת הבוקר דרך GHL: לכל משתתף שהופעל ויש לו ghl_contact_id, שורה אחת ב־reminder_log (channel ghl) לכל תאריך מקומי,
 * ובמצב live גם שורת outbox (באותה טרנזקציה). ה־outbox שולח (שדה מותאם ותג) עם ניסיונות חוזרים. dry: רושם שורת dry_run
 * ושורת יומן לכל משתמש, ולא קורא ל־GHL. null כש־GHL_REMINDER_MODE כבוי.
 */
export async function queueGhlReminders(args: {
  db: Db;
  cfg: GhlConfig;
  day: number;
  date: string;
  log?: Logger;
  claimBatchSize?: number;
  runBudgetMs?: number;
}): Promise<GhlReminderResult | null> {
  const { db, cfg, day, date } = args;
  const log = args.log ?? logger;
  if (cfg.reminderMode === "off") return null;
  const live = cfg.reminderMode === "live";
  const initial = live ? "pending" : "dry_run";
  const batch = args.claimBatchSize ?? REMINDERS.claimBatchSize;
  const budget = args.runBudgetMs ?? REMINDERS.runBudgetMs;
  const started = Date.now();
  const tag = `${cfg.tags.reminderPrefix}${day}`;
  let claimed = 0;

  for (;;) {
    const ids = await db.transaction(async (tx) => {
      const got = rowsOf<{ user_id: string }>(
        await tx.execute(
          sql`insert into reminder_log (user_id, date, channel, status)
              select u.id, ${date}::date, 'ghl', ${initial}
                from users u
               where u.password_hash is not null and u.activated_at is not null and u.ghl_contact_id is not null
                 and not exists (select 1 from reminder_log r where r.user_id = u.id and r.date = ${date}::date and r.channel = 'ghl')
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
                values (${id}, ${GHL_REMINDER_KIND}, ${reminderDedupeKey(id, date)}, ${JSON.stringify({ date, day })}::jsonb)
                on conflict (dedupe_key) do nothing`,
          );
        }
      }
      return got;
    });
    claimed += ids.length;
    if (!live) for (const id of ids) log.info("ghl reminder dry-run (not sent)", { userId: id, day, tag, field: cfg.fields.todayUrl });
    if (ids.length < batch || Date.now() - started >= budget) break;
  }
  log.info("ghl reminders queued", { mode: cfg.reminderMode, claimed, day });
  return { mode: cfg.reminderMode, claimed };
}
