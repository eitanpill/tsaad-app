import { REMINDERS } from "@/config/constants";
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

/** האם דקות מחצות הן אחת מהבחירות: כל 30 דקות, מ־05:30 עד 21:00. */
export function isReminderMinutes(m: unknown): m is number {
  return (
    typeof m === "number" &&
    Number.isInteger(m) &&
    m >= REMINDERS.timeMinMinutes &&
    m <= REMINDERS.timeMaxMinutes &&
    (m - REMINDERS.timeMinMinutes) % REMINDERS.timeStepMinutes === 0
  );
}

/** כל הבחירות האפשריות (דקות מחצות), בסדר עולה. */
export function reminderChoices(): number[] {
  const out: number[] = [];
  for (let m = REMINDERS.timeMinMinutes; m <= REMINDERS.timeMaxMinutes; m += REMINDERS.timeStepMinutes) out.push(m);
  return out;
}

const two = (n: number) => String(n).padStart(2, "0");

/** דקות מחצות כ־"HH:MM". */
export function formatMinutes(m: number): string {
  return `${two(Math.floor(m / 60))}:${two(m % 60)}`;
}

/**
 * סוף חלון השליחה: שעת הבחירה + 4.5 שעות, לא יותר מ־23:59 של אותו יום (דקות מחצות).
 * מהדקה הזאת ואילך כבר לא שולחים (אותו כלל "אחרי" כמו תמיד: דקה == cutoff כבר מאוחר).
 */
export function reminderCutoffMinutes(reminderMinutes: number): number {
  return Math.min(reminderMinutes + REMINDERS.retryWindowMinutes, REMINDERS.latestCutoffMinutes);
}

/**
 * האם התזכורת של משתמש עם שעת בחירה reminderMinutes מגיעה לשליחה ברגע הזה:
 * בריצה הראשונה בשעה או אחריה, פעם אחת לתאריך מקומי, ולפני ה־cutoff של המשתמש.
 * `handled`: כבר יש שורה ב־reminder_log לתאריך של היום בערוץ הזה (גם אם השעה שונתה מאז).
 */
export function reminderDueForUser(args: {
  now: Date;
  timeZone: string;
  reminderMinutes: number;
  handled: boolean;
}): ReminderCheck {
  const date = localDate(args.now, args.timeZone);
  return reminderDue({
    now: args.now,
    timeZone: args.timeZone,
    reminderTime: formatMinutes(args.reminderMinutes),
    cutoffTime: formatMinutes(reminderCutoffMinutes(args.reminderMinutes)),
    alreadyHandledDates: args.handled ? [date] : [],
  });
}
