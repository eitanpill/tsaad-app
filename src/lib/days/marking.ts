import { addDays, localDate, zonedTimeToInstant } from "@/lib/time/zone";
import {
  assertDay,
  dayDate,
  dayStatusAt,
  isDayUnlocked,
  type Schedule,
} from "./schedule";

/**
 * כלל הסימון (החלטת פית):
 *  - אפשר לסמן את יום האתגר הנוכחי.
 *  - אפשר לסמן את "אתמול" רק עד 24:00 שעון ישראל של היום (עד סוף יום הלוח).
 *  - ימים מוקדמים יותר סגורים ("לא נספר").
 *
 * הגדרה מדויקת: ליום N יש תאריך פתיחה D(N) = start + N-1. יום N ניתן לסימון
 * ברגע t אם ורק אם הוא כבר נפתח (t >= D(N) בשעת הפתיחה) וגם התאריך המקומי של t
 * הוא לכל היותר D(N)+1. כלומר החלון נסגר ב־00:00 (שעון מקומי) שפותח את D(N)+2.
 *
 * תוצאות:
 *  - יום N הופך ל"אתמול" ב־05:00 של D(N)+1 (כשיום N+1 נפתח), ונסגר ב־00:00 של D(N)+2,
 *    כלומר ל"אתמול" נשארות 19 שעות (05:00 עד 24:00).
 *  - בין 00:00 ל־05:00 של D(N)+1 יום N עדיין היום הנוכחי ולכן פתוח, אבל
 *    יום N-1 כבר סגור, כי נסגר בחצות שפתחה את התאריך הזה. בחלון הזה רק יום אחד פתוח.
 *  - יום 14 (D = start+13) נשאר פתוח עד 00:00 של start+15, גם אחרי שהאתגר "הסתיים"
 *    ב־05:00 של start+14.
 */
export type MarkState =
  | { ok: true; kind: "current" | "yesterday"; closesAt: Date }
  | { ok: false; reason: "locked" | "closed" };

export function markDeadline(day: number, s: Schedule): Date {
  return zonedTimeToInstant(addDays(dayDate(day, s), 2), "00:00", s.timeZone);
}

export function markState(day: number, instant: Date, s: Schedule): MarkState {
  assertDay(day, s);
  if (!isDayUnlocked(day, instant, s)) return { ok: false, reason: "locked" };
  const closesAt = markDeadline(day, s);
  if (localDate(instant, s.timeZone) > addDays(dayDate(day, s), 1)) {
    return { ok: false, reason: "closed" };
  }
  const st = dayStatusAt(instant, s);
  const current = st.phase === "active" && st.day === day;
  return { ok: true, kind: current ? "current" : "yesterday", closesAt };
}

export function canMark(day: number, instant: Date, s: Schedule): boolean {
  return markState(day, instant, s).ok;
}
