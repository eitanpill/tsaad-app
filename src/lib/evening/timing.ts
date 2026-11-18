import { EVENING, LIVE, LIVE_REMINDER } from "@/config/constants";
import type { Schedule } from "@/lib/days/schedule";
import { diffDays, localDate, parseHHMM } from "@/lib/time/zone";

/** ללא server-only: תזמון טהור שנבדק ביחידה. */

/** יום ערב ברגע נתון: 0 (הערב שלפני START_DATE) עד 14; מחוץ לטווח null. לפי התאריך המקומי (הערב אחרי 05:00 תמיד). */
export function eveningDay(now: Date, schedule: Schedule | null): number | null {
  if (!schedule) return null;
  const n = diffDays(schedule.startDate, localDate(now, schedule.timeZone)) + 1;
  return n >= EVENING.firstDay && n <= EVENING.lastDay ? n : null;
}

/**
 * מתי תזכורת הערב מגיעה (דקות מחצות מקומיות). ברירת מחדל: שעת הערב. ביום לייב (0, 7, 14) עם שעת מפגש מוגדרת, אם שעת הערב
 * נופלת ב־[התחלה פחות LIVE_REMINDER.leadMinutes, התחלה ועוד LIVE.calendarDurationMinutes), היא נדחית לסוף המפגש.
 */
export function eveningDueMinutes(args: { eveningTime: string; day: number; liveTime?: string }): number {
  const evening = parseHHMM(args.eveningTime);
  if (!args.liveTime || !(LIVE.sessionDays as readonly number[]).includes(args.day)) return evening;
  const start = parseHHMM(args.liveTime);
  const from = start - LIVE_REMINDER.leadMinutes;
  const end = start + LIVE.calendarDurationMinutes;
  return evening >= from && evening < end ? end : evening;
}

/** האם התזכורת מגיעה עכשיו: מהרגע שהגיע ועד (לא כולל) ה־cutoff. */
export function eveningDueNow(nowMinutes: number, dueMinutes: number): boolean {
  return nowMinutes >= dueMinutes && nowMinutes < EVENING.cutoffMinutes;
}
