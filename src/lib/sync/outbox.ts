import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { SYNC } from "@/config/constants";
import { rowsOf } from "@/lib/auth/sql";
import { redactText } from "@/lib/logger";
import { backoffSeconds } from "./backoff";
import {
  TRACKER_KIND,
  buildTrackerPayload,
  trackerDedupeKey,
  trackerPayloadSchema,
  type TrackerPayload,
} from "./payload";

type Exec = Pick<Db, "execute">;

/** מנקה ומקצר שגיאה לפני שמירה (אין PII, כתובות או אסימונים ב־last_error). */
export function sanitizeError(err: unknown, max: number = SYNC.maxErrorLength): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const clean = redactText(raw).replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * מכניס לתור את מצב המעקב של משתמש ליום נתון. מפתח הכפילות הוא (משתמש, יום):
 * - אותו מטען שוב: לא קורה כלום.
 * - מטען שונה: השורה מתעדכנת למצב האחרון והופכת שוב לממתינה (אפס ניסיונות).
 * @returns true אם נכתבה או התעדכנה שורה.
 */
export async function enqueueTrackerSync(
  db: Exec,
  args: { userId: string; day: number },
): Promise<boolean> {
  const payload = await buildTrackerPayload(db, args.userId, args.day);
  if (!payload) return false;
  return enqueue(db, args.userId, TRACKER_KIND, trackerDedupeKey(args.userId, args.day), payload);
}

export async function enqueue(
  db: Exec,
  userId: string,
  kind: string,
  dedupeKey: string,
  payload: TrackerPayload,
): Promise<boolean> {
  const safe = trackerPayloadSchema.parse(payload);
  const res = await db.execute(
    sql`insert into sync_outbox (user_id, kind, dedupe_key, payload)
        values (${userId}, ${kind}, ${dedupeKey}, ${JSON.stringify(safe)}::jsonb)
        on conflict (dedupe_key) do update
          set payload = excluded.payload, status = 'pending', attempts = 0,
              next_attempt_at = now(), last_error = null
          where sync_outbox.payload is distinct from excluded.payload
        returning id`,
  );
  return rowsOf<{ id: string }>(res).length > 0;
}

export type ClaimedRow = {
  id: string;
  kind: string;
  payload: unknown;
  /** מספר הניסיון הזה (כבר כולל אותו). */
  attempts: number;
};

/**
 * תופס שורות לעיבוד. FOR UPDATE SKIP LOCKED מבטיח שריצות חופפות לא יתפסו אותן שורות,
 * והשורה נשמרת ("lease") על ידי הזזת next_attempt_at קדימה, כך שגם אחרי שהנעילה
 * משתחררת שום ריצה אחרת לא תיקח אותה, ואם התהליך קורס היא תחזור לתור בסוף ה־lease.
 * מספר הניסיונות עולה בתפיסה.
 */
export async function claimDue(
  db: Exec,
  limit: number = SYNC.batchSize,
  leaseSeconds: number = SYNC.leaseSeconds,
  /** רק שורות מהסוגים האלה (ברירת מחדל: כולם). סוגים שונים מעובדים בעובדים שונים. */
  kinds?: readonly string[],
): Promise<ClaimedRow[]> {
  const kindFilter = kinds ? sql` and kind = any(array[${sql.join(kinds.map((k) => sql`${k}`), sql`, `)}]::text[])` : sql``;
  const res = await db.execute(
    sql`with due as (
          select id from sync_outbox
          where status in ('pending','failed') and next_attempt_at <= now()${kindFilter}
          order by next_attempt_at, created_at
          limit ${limit}
          for update skip locked
        )
        update sync_outbox o
           set attempts = o.attempts + 1,
               next_attempt_at = now() + make_interval(secs => ${leaseSeconds})
          from due
         where o.id = due.id
        returning o.id, o.kind, o.payload, o.attempts`,
  );
  return rowsOf<ClaimedRow>(res);
}

/**
 * מסמן כנשלח, רק אם המטען לא השתנה בינתיים (אחרת השורה כבר חזרה לתור עם המצב החדש)
 * ורק אם השורה עדיין בטיפול (לא sent/dead).
 */
export async function markSent(db: Exec, row: ClaimedRow): Promise<boolean> {
  const res = await db.execute(
    sql`update sync_outbox set status = 'sent', last_error = null
        where id = ${row.id} and attempts = ${row.attempts}
          and status in ('pending','failed')
          and payload = ${JSON.stringify(row.payload)}::jsonb
        returning id`,
  );
  return rowsOf(res).length > 0;
}

/**
 * מסמן כשל: ניסיון חוזר עם backoff מעריכי + ג'יטר, או dead כשחרגנו ממספר הניסיונות
 * (או כשהכשל אינו ניתן לניסיון חוזר).
 * אותם תנאים כמו markSent: attempts לבדו לא מספיק, כי enqueue מאפס אותו, ותוצאה ישנה
 * של עובד אחד יכולה הייתה לדרוס תפיסה חדשה (או שורה שכבר נשלחה) של עובד אחר.
 * @returns המצב החדש, או null אם השורה כבר השתנתה.
 */
export async function markFailed(
  db: Exec,
  row: ClaimedRow,
  error: unknown,
  opts: { retryable?: boolean; random?: () => number; maxAttempts?: number } = {},
): Promise<"failed" | "dead" | null> {
  const retryable = opts.retryable ?? true;
  const dead = !retryable || row.attempts >= (opts.maxAttempts ?? SYNC.maxAttempts);
  const delay = backoffSeconds(row.attempts, opts.random);
  const res = await db.execute(
    sql`update sync_outbox
           set status = ${dead ? "dead" : "failed"},
               last_error = ${sanitizeError(error)},
               next_attempt_at = case when ${dead} then next_attempt_at
                                      else now() + make_interval(secs => ${delay}) end
         where id = ${row.id} and attempts = ${row.attempts}
           and status in ('pending','failed')
           and payload = ${JSON.stringify(row.payload)}::jsonb
        returning status`,
  );
  return rowsOf<{ status: "failed" | "dead" }>(res)[0]?.status ?? null;
}
