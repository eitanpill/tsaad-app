import { LIVE_REMINDER } from "@/config/constants";
import { dayDate, type Schedule } from "@/lib/days";
import { LIVE_DAYS, sessionStart, type LiveDay, type LiveInput } from "./model";

/** ללא server-only: מודל טהור שנבדק עם שעון מדומה. */
const MIN = 60_000;

/**
 * חלון תזכורת הלייב: מ־LIVE_REMINDER.leadMinutes לפני תחילת המפגש (כולל, הרגע שהקישור נפתח) ועד התחלתו (לא כולל).
 * ריצה שמאחרת אל אחרי ההתחלה לא שולחת (אף פעם לא אחרי שהמפגש התחיל).
 */
export function liveReminderDue(now: Date, startsAt: Date | null): boolean {
  if (!startsAt) return false;
  const t = now.getTime();
  const s = startsAt.getTime();
  return t >= s - LIVE_REMINDER.leadMinutes * MIN && t < s;
}

export type DueLiveReminder = {
  day: LiveDay;
  /** התאריך המקומי של יום הלייב ("YYYY-MM-DD"); זה גם התאריך ב־reminder_log. */
  date: string;
  /** "HH:MM" מהתצורה. */
  time: string;
  startsAt: Date;
};

/** תזכורות הלייב שמגיעות לשליחה ברגע הזה. בלי שעה מוגדרת (או בלי תאריך התחלה) לא מחזיר דבר. */
export function dueLiveReminders(
  now: Date,
  schedule: Schedule | null,
  inputs: Record<LiveDay, Pick<LiveInput, "time">>,
): DueLiveReminder[] {
  if (!schedule) return [];
  const out: DueLiveReminder[] = [];
  for (const day of LIVE_DAYS) {
    const time = inputs[day].time;
    const startsAt = sessionStart(day, schedule, time);
    if (time && startsAt && liveReminderDue(now, startsAt)) {
      out.push({ day, date: dayDate(day, schedule), time, startsAt });
    }
  }
  return out;
}
