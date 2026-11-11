import { addDays } from "@/lib/time/zone";
import { challengeDate, makeSchedule, type Schedule } from "@/lib/days";

/**
 * לוח וירטואלי לתצוגה מקדימה: התאריך של "היום" באתגר (לפי שעת הפתיחה) הוא יום N, ולכן ההתחלה היא היום פחות N-1 ימים.
 * לא תלוי ב־START_DATE (גם כשהוא לא מוגדר, וגם כשהוא מוגדר).
 */
export function previewSchedule(now: Date, day: number, opts: { timeZone: string; unlockTime: string }): Schedule {
  const probe = makeSchedule("2000-01-01", opts);
  return makeSchedule(addDays(challengeDate(now, probe), -(day - 1)), opts);
}
