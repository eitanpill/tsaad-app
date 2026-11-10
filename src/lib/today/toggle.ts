import "server-only";
import { and, eq } from "drizzle-orm";
import { actionCompletions } from "@/db/schema";
import type { Db } from "@/db";
import { ACTIONS, isActionValidForDay, markState, stepsFor, type Action, type Schedule } from "@/lib/days";
import { enqueueTrackerSync } from "@/lib/sync";
import { RATE_LIMITS } from "@/lib/auth/config";
import { rateLimitKeys, registerAttempt } from "@/lib/auth/rate-limit";
import { listDayCompletions } from "./completions";

export type ToggleError = "invalid" | "locked" | "closed" | "rate_limited";

export type ToggleResult =
  | { ok: true; day: number; action: Action; done: boolean; steps: number; changed: boolean }
  | { ok: false; error: ToggleError };

/**
 * מגבלת קצב לסימונים, לפי משתמש (כל קריאה נספרת, גם לא תקינה). שימוש רגיל רחוק ממנה מאוד;
 * היא רק עוצרת לולאת כתיבות (וסנכרונים) מחשבון אחד. המזהה נשמר כ־HMAC, כמו בשאר מגבלות הקצב.
 */
export async function toggleRateAllowed(
  db: Pick<Db, "execute">,
  secret: string,
  userId: string,
  limits: { windowSeconds: number; perIdentifier: number; perIp: number } = RATE_LIMITS.toggle,
): Promise<boolean> {
  const r = await registerAttempt(db, "toggle", rateLimitKeys(secret, userId, null), limits);
  return r.allowed;
}

export function isAction(v: unknown): v is Action {
  return typeof v === "string" && (ACTIONS as readonly string[]).includes(v);
}

/**
 * סימון או ביטול סימון של פעולה אחת, לפי הכללים של השרת (בלי אמון בלקוח):
 *  - day ו־action חייבים להיות תקפים (יום 1..14; לייב רק בימי לייב, תנועה ומדיטציה רק בימים רגילים).
 *  - יום שעוד לא נפתח: "locked". יום שנסגר (אחרי חצות של אתמול): "closed".
 *  - אידמפוטנטי: `desired` קובע את המצב הרצוי (ניסיון חוזר לא הופך את הסימון). בלי `desired`, הפעולה מתהפכת.
 *  - סימון: insert ... on conflict do nothing (יש unique על משתמש/יום/פעולה). ביטול: delete.
 *  - אם משהו השתנה, השינוי והכנסה לתור הסנכרון נעשים באותה טרנזקציה (בלי רשת; השליחה נעשית ב־cron).
 * userId תמיד מגיע מהסשן, ולכן אי אפשר לגעת בנתוני משתמש אחר.
 */
export async function toggleActionCore(
  db: Db,
  args: {
    userId: string;
    day: unknown;
    action: unknown;
    desired?: boolean;
    now: Date;
    schedule: Schedule | null;
  },
): Promise<ToggleResult> {
  const { userId, now, schedule } = args;
  const { day, action } = args;
  if (!schedule) return { ok: false, error: "locked" }; // האתגר עוד לא התחיל (אין START_DATE)
  if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > schedule.totalDays) {
    return { ok: false, error: "invalid" };
  }
  if (!isAction(action) || !isActionValidForDay(day, action)) return { ok: false, error: "invalid" };

  const state = markState(day, now, schedule);
  if (!state.ok) return { ok: false, error: state.reason };

  return db.transaction(async (tx) => {
    const existing = (await listDayCompletions(tx, userId, day)).includes(action);
    const want = args.desired ?? !existing;
    let changed = false;
    if (want && !existing) {
      const inserted = await tx
        .insert(actionCompletions)
        .values({ userId, day, action })
        .onConflictDoNothing()
        .returning({ id: actionCompletions.id });
      changed = inserted.length > 0;
    } else if (!want && existing) {
      const deleted = await tx
        .delete(actionCompletions)
        .where(
          and(
            eq(actionCompletions.userId, userId),
            eq(actionCompletions.day, day),
            eq(actionCompletions.action, action),
          ),
        )
        .returning({ id: actionCompletions.id });
      changed = deleted.length > 0;
    }
    if (changed) await enqueueTrackerSync(tx, { userId, day });
    const now2 = await listDayCompletions(tx, userId, day);
    return {
      ok: true as const,
      day,
      action,
      done: now2.includes(action),
      steps: stepsFor(day, now2),
      changed,
    };
  });
}
