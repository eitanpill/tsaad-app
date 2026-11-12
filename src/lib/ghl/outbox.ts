import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { GHL, REMINDERS } from "@/config/constants";
import { rowsOf } from "@/lib/auth/sql";
import { logger, type Logger } from "@/lib/logger";
import { localDate, localMinutes, parseHHMM } from "@/lib/time/zone";
import { claimDue, markFailed, markSent, sanitizeError, type ClaimedRow } from "@/lib/sync/outbox";
import { setFieldAndTag, type GhlClient, type GhlResult } from "./client";
import type { GhlConfig } from "./config";

export const GHL_REMINDER_KIND = "ghl_reminder";
export const GHL_LINK_KIND = "ghl_link";
export type LinkKind = "activate" | "reset";

/** המטענים אינם כוללים פרטים אישיים ולא קישורים: רק יום ותאריך, או מטרת הקישור (האסימון מונפק מחדש בשליחה). */
export const reminderPayloadSchema = z.strictObject({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), day: z.number().int().min(1).max(14) });
export const linkPayloadSchema = z.strictObject({ purpose: z.enum(["activate", "reset"]) });

type Exec = Pick<Db, "execute">;

export const reminderDedupeKey = (userId: string, date: string) => `${GHL_REMINDER_KIND}:${userId}:${date}`;
export const linkDedupeKey = (userId: string, purpose: LinkKind) => `${GHL_LINK_KIND}:${userId}:${purpose}`;

/**
 * שורת קישור: בקשה חדשה מאפסת שורה קיימת (גם אם נשלחה), כי המשתמש ביקש קישור חדש.
 * delaySeconds: לא לפני כן (למשל Retry-After של 429).
 */
export async function enqueueLink(db: Exec, userId: string, purpose: LinkKind, delaySeconds = 0): Promise<void> {
  const delay = Math.min(Math.max(0, Math.ceil(delaySeconds)), 60 * 60);
  await db.execute(
    sql`insert into sync_outbox (user_id, kind, dedupe_key, payload, next_attempt_at)
        values (${userId}, ${GHL_LINK_KIND}, ${linkDedupeKey(userId, purpose)}, ${JSON.stringify({ purpose })}::jsonb,
                now() + make_interval(secs => ${delay}))
        on conflict (dedupe_key) do update
          set status = 'pending', attempts = 0, next_attempt_at = excluded.next_attempt_at, last_error = null`,
  );
}

/**
 * קישור נמסר ישירות: ניסיון חוזר שעוד ממתין בתור לאותה מטרה מבוטל, אחרת הוא היה מנפיק אסימון חדש
 * ומבטל את הקישור שהמשתמש/ת בדיוק קיבל/ה.
 */
export async function cancelQueuedLink(db: Exec, userId: string, purpose: LinkKind): Promise<void> {
  await db.execute(
    sql`update sync_outbox set status = 'sent', last_error = null
        where dedupe_key = ${linkDedupeKey(userId, purpose)} and status in ('pending','failed')`,
  );
}

export type GhlRunResult = { claimed: number; sent: number; failed: number; dead: number };

export type GhlWorkerDeps = {
  db: Db;
  cfg: GhlConfig;
  client: GhlClient | null;
  /** מנפיק קישור חדש (אסימון חדש) למשתמש לפי מטרה. */
  makeLink: (userId: string, purpose: LinkKind) => Promise<string>;
  now?: Date;
  log?: Logger;
  random?: () => number;
  timeZone: string;
  origin: string | undefined;
  /** לבדיקות; ברירת מחדל GHL.claimChunk / GHL.runBudgetMs / GHL.batchSize. */
  claimChunk?: number;
  runBudgetMs?: number;
  maxRows?: number;
};

type UserRow = { ghl_contact_id: string | null; email: string | null; password_hash: string | null; activated_at: unknown; whatsapp_reminders: boolean; disabled_at: unknown };

/**
 * מעבד שורות outbox של GHL (תזכורות וקישורים) עם SKIP LOCKED, backoff וניסיון חוזר, דרך ה־outbox הקיים.
 * מעבד רק סוגים שהמצב שלהם live. בלי לקוח או בלי סוג live לא נוגע במסד ולא ברשת.
 * תופס בסבבים קטנים (GHL.claimChunk) ומפסיק לתפוס אחרי GHL.runBudgetMs, כדי שכל סבב יסתיים הרבה לפני שה־lease
 * של השורות שלו פג (אחרת ריצה מקבילה הייתה תופסת אותן שוב ושולחת פעמיים).
 */
export async function runGhlOutbox(deps: GhlWorkerDeps): Promise<GhlRunResult> {
  const log = deps.log ?? logger;
  const result: GhlRunResult = { claimed: 0, sent: 0, failed: 0, dead: 0 };
  const kinds: string[] = [];
  if (deps.cfg.reminderMode === "live") kinds.push(GHL_REMINDER_KIND);
  if (deps.cfg.deliveryMode === "live") kinds.push(GHL_LINK_KIND);
  if (!deps.client || kinds.length === 0) return result;
  const now = deps.now ?? new Date();
  const chunk = deps.claimChunk ?? GHL.claimChunk;
  const budget = deps.runBudgetMs ?? GHL.runBudgetMs;
  const maxRows = deps.maxRows ?? GHL.batchSize;
  const started = Date.now();

  while (result.claimed < maxRows && Date.now() - started < budget) {
    const rows = await claimDue(deps.db, Math.min(chunk, maxRows - result.claimed), undefined, kinds);
    if (rows.length === 0) break;
    result.claimed += rows.length;
    await processRows(deps, rows, now, result, log);
    if (rows.length < chunk) break;
  }
  log.info("ghl outbox run", { ...result });
  return result;
}

async function processRows(deps: GhlWorkerDeps, rows: ClaimedRow[], now: Date, result: GhlRunResult, log: Logger) {
  for (const row of rows) {
    let outcome: GhlResult;
    let userId = "";
    try {
      const r = await processRow(deps, row, now);
      outcome = r.outcome;
      userId = r.userId;
    } catch (e) {
      outcome = { ok: false, retryable: true, error: sanitizeError(e) };
    }
    if (outcome.ok) {
      if (await markSent(deps.db, row)) result.sent++;
      if (row.kind === GHL_REMINDER_KIND) await setReminderStatus(deps.db, row, "sent");
    } else {
      const state = await markFailed(deps.db, row, outcome.error, {
        retryable: outcome.retryable,
        random: deps.random,
        minDelaySeconds: outcome.retryAfterSeconds,
      });
      if (state === "dead") {
        result.dead++;
        if (row.kind === GHL_REMINDER_KIND) await setReminderStatus(deps.db, row, "failed");
        log.warn("ghl outbox row gave up", { kind: row.kind, userId, error: outcome.error });
      } else if (state === "failed") result.failed++;
    }
  }
}

async function setReminderStatus(db: Exec, row: ClaimedRow, status: "sent" | "failed") {
  const p = reminderPayloadSchema.safeParse(row.payload);
  if (!p.success) return;
  await db.execute(
    sql`update reminder_log set status = ${status}
        where channel = 'ghl' and date = ${p.data.date}::date and status = 'pending'
          and user_id = (select user_id from sync_outbox where id = ${row.id})`,
  );
}

async function processRow(deps: GhlWorkerDeps, row: ClaimedRow, now: Date): Promise<{ outcome: GhlResult; userId: string }> {
  const { db, cfg, client } = deps;
  const own = rowsOf<{ user_id: string }>(await db.execute(sql`select user_id from sync_outbox where id = ${row.id}`))[0];
  const userId = own?.user_id ?? "";
  const dead = (error: string): { outcome: GhlResult; userId: string } => ({ outcome: { ok: false, retryable: false, error }, userId });
  if (!userId || !client) return dead("row vanished");
  const user = rowsOf<UserRow>(
    await db.execute(
      sql`select ghl_contact_id, email, password_hash, activated_at, whatsapp_reminders, disabled_at from users where id = ${userId}`,
    ),
  )[0];
  if (!user?.ghl_contact_id) return dead("no ghl contact");
  if (user.disabled_at) return dead("account disabled");
  const contactId = user.ghl_contact_id;

  if (row.kind === GHL_REMINDER_KIND) {
    const p = reminderPayloadSchema.safeParse(row.payload);
    if (!p.success) return dead("invalid payload");
    // כיבו את תזכורת הוואטסאפ אחרי שנכנסה לתור: לא שולחים.
    if (!user.whatsapp_reminders) return dead("opted out");
    // תזכורת בוקר שימושית רק באותו בוקר.
    if (localDate(now, deps.timeZone) !== p.data.date || localMinutes(now, deps.timeZone) >= parseHHMM(REMINDERS.cutoffTime)) {
      return dead("stale reminder");
    }
    if (!deps.origin) return dead("APP_ORIGIN not set");
    const outcome = await setFieldAndTag(client, {
      contactId,
      fieldKey: cfg.fields.todayUrl,
      fieldId: cfg.fields.todayUrlId,
      value: `${deps.origin}${REMINDERS.openPath}`,
      tag: `${cfg.tags.reminderPrefix}${p.data.day}`,
      rearm: false,
      locationId: cfg.locationId,
    });
    return { outcome, userId };
  }

  const p = linkPayloadSchema.safeParse(row.payload);
  if (!p.success) return dead("invalid payload");
  const activated = user.password_hash !== null || user.activated_at !== null;
  // המצב השתנה מאז הבקשה (הופעל בינתיים, או עוד לא): אין מה לשלוח.
  if (p.data.purpose === "activate" && activated) return { outcome: { ok: true }, userId };
  if (p.data.purpose === "reset" && !activated) return dead("account not activated");
  // קישורים יוצאים במייל בלבד: בלי מייל אין לאן לשלוח (בעל האתר שולח ידנית).
  if (!user.email) return dead("no email");
  const link = await deps.makeLink(userId, p.data.purpose);
  const outcome = await setFieldAndTag(client, {
    contactId,
    fieldKey: cfg.fields.activationUrl,
    fieldId: cfg.fields.activationUrlId,
    value: link,
    tag: p.data.purpose === "activate" ? cfg.tags.accountReady : cfg.tags.resetReady,
    rearm: true,
    locationId: cfg.locationId,
  });
  return { outcome, userId };
}
