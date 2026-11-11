import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { CHALLENGE } from "@/config/constants";
import { dayCounts, stepsFor, type Action } from "@/lib/days/cup";
import { assertDay } from "@/lib/days/schedule";
import { rowsOf } from "@/lib/auth/sql";

/**
 * מה ש־GHL צריך לדעת, ותו לא: מזהה איש קשר, היום, כמה ימים נספרו, האם הושלם האתגר
 * והנוכחות בלייב (נגזרת מ־action_completions). אין כאן שם, דוא"ל, טלפון, שם משתמש או אסימונים, והסכמה strict
 * דוחה כל שדה נוסף (בדיקה בזמן כתיבה לתור ובזמן שליחה).
 */
export const trackerPayloadSchema = z.strictObject({
  ghl_contact_id: z.string().min(1).max(128),
  day: z.number().int().min(1).max(CHALLENGE.totalDays),
  counted_days: z.number().int().min(0).max(CHALLENGE.totalDays),
  completed: z.boolean(),
  live_attendance: z.strictObject({
    day7: z.boolean().nullable(),
    day14: z.boolean().nullable(),
  }),
});

export type TrackerPayload = z.infer<typeof trackerPayloadSchema>;

export const TRACKER_KIND = "tracker";

export const trackerDedupeKey = (userId: string, day: number) => `${TRACKER_KIND}:${userId}:${day}`;

/**
 * בונה את המטען מהמסד. מחזיר null למשתמש בלי ghl_contact_id (אין למי לסנכרן) ולמשתמש מושבת.
 * סופרים "ימים שנספרו" לפי אותו כלל כמו הכוס: צעד אחד ביום מספיק.
 */
export async function buildTrackerPayload(
  db: Pick<Db, "execute">,
  userId: string,
  day: number,
): Promise<TrackerPayload | null> {
  assertDay(day, { totalDays: CHALLENGE.totalDays });
  const user = rowsOf<{ ghl_contact_id: string | null; disabled_at: Date | string | null }>(
    await db.execute(sql`select ghl_contact_id, disabled_at from users where id = ${userId}`),
  )[0];
  if (!user?.ghl_contact_id || user.disabled_at) return null;

  const completions = rowsOf<{ day: number; action: Action }>(
    await db.execute(sql`select day, action from action_completions where user_id = ${userId}`),
  );
  const byDay = new Map<number, Action[]>();
  for (const c of completions) byDay.set(c.day, [...(byDay.get(c.day) ?? []), c.action]);
  let counted = 0;
  for (const [d, actions] of byDay) if (dayCounts(stepsFor(d, actions))) counted++;

  // נוכחות בלייב: מקור האמת היחיד הוא action_completions (פעולה "live", ימים 7 ו־14).
  // יש שורה = נכח/ה; אין שורה = עדיין לא סומן (null). אין ערך false: ביטול הסימון מוחק את השורה.
  const liveDays = new Set(completions.filter((c) => c.action === "live").map((c) => c.day));
  const att = (d: number) => (liveDays.has(d) ? true : null);

  return trackerPayloadSchema.parse({
    ghl_contact_id: user.ghl_contact_id,
    day,
    counted_days: counted,
    completed: counted >= CHALLENGE.daysToComplete,
    live_attendance: { day7: att(7), day14: att(14) },
  });
}
