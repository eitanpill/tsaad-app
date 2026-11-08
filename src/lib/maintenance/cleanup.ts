import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { RETENTION } from "@/config/constants";
import { purgeExpired } from "@/lib/auth/session";

const deleted = (res: unknown) => (res as { rowCount?: number | null } | null)?.rowCount ?? 0;

export type CleanupResult = Record<
  | "sessions"
  | "activationTokens"
  | "loginAttempts"
  | "webhookEvents"
  | "syncSent"
  | "syncDead"
  | "reminderLog",
  number
>;

/** ניקוי יומי לפי RETENTION. מחזיר רק ספירות. */
export async function runCleanup(db: Pick<Db, "execute">): Promise<CleanupResult> {
  const auth = await purgeExpired(db);
  const webhookEvents = await db.execute(
    sql`delete from webhook_events where received_at < now() - make_interval(days => ${RETENTION.webhookEventsDays})`,
  );
  const syncSent = await db.execute(
    sql`delete from sync_outbox where status = 'sent'
        and created_at < now() - make_interval(days => ${RETENTION.syncSentDays})`,
  );
  const syncDead = await db.execute(
    sql`delete from sync_outbox where status = 'dead'
        and created_at < now() - make_interval(days => ${RETENTION.syncDeadDays})`,
  );
  const reminderLog = await db.execute(
    sql`delete from reminder_log where created_at < now() - make_interval(days => ${RETENTION.reminderLogDays})`,
  );
  return {
    ...auth,
    webhookEvents: deleted(webhookEvents),
    syncSent: deleted(syncSent),
    syncDead: deleted(syncDead),
    reminderLog: deleted(reminderLog),
  };
}
