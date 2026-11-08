import { localDate, localMinutes, parseHHMM } from "@/lib/time/zone";

export type ReminderCheck =
  | { due: true; date: string }
  | { due: false; reason: "too_early" | "already_handled" | "past_cutoff" };

/**
 * תזכורת מגיעה לריצה הראשונה ב־reminderTime או אחריה, פעם אחת למשתמש לתאריך מקומי.
 * אין תלות בהתאמה של דקה מדויקת (ה־cron עלול להתאחר או לדלג).
 * @param alreadyHandledDates תאריכים שכבר יש להם רשומה ב־reminder_log למשתמש.
 * @param cutoffTime אופציונלי: אחריו לא שולחים עוד (HH:MM, שעה לא מוגדרת עדיין).
 */
export function reminderDue(args: {
  now: Date;
  timeZone: string;
  reminderTime: string;
  alreadyHandledDates: Iterable<string>;
  cutoffTime?: string;
}): ReminderCheck {
  const { now, timeZone } = args;
  const date = localDate(now, timeZone);
  const minutes = localMinutes(now, timeZone);
  if (minutes < parseHHMM(args.reminderTime)) return { due: false, reason: "too_early" };
  if (args.cutoffTime !== undefined && minutes >= parseHHMM(args.cutoffTime)) {
    return { due: false, reason: "past_cutoff" };
  }
  for (const d of args.alreadyHandledDates) {
    if (d === date) return { due: false, reason: "already_handled" };
  }
  return { due: true, date };
}
