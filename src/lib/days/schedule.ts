import { CHALLENGE } from "@/config/constants";
import {
  addDays,
  diffDays,
  localDate,
  localMinutes,
  parseHHMM,
  zonedTimeToInstant,
} from "@/lib/time/zone";

export type Schedule = {
  /** תאריך תחילת האתגר, "YYYY-MM-DD" (יום 1 נפתח ב־unlockTime בתאריך הזה). */
  startDate: string;
  timeZone: string;
  /** "HH:MM", ברירת מחדל 05:00. */
  unlockTime: string;
  totalDays: number;
};

export function makeSchedule(
  startDate: string,
  opts: Partial<Omit<Schedule, "startDate">> = {},
): Schedule {
  addDays(startDate, 0); // מאמת פורמט
  return {
    startDate,
    timeZone: opts.timeZone ?? CHALLENGE.timeZone,
    unlockTime: opts.unlockTime ?? CHALLENGE.unlockTime,
    totalDays: opts.totalDays ?? CHALLENGE.totalDays,
  };
}

export type DayStatus =
  | { phase: "before_start" }
  | { phase: "active"; day: number }
  | { phase: "ended" };

/**
 * "תאריך היום של האתגר": התאריך המקומי, או התאריך הקודם אם השעה המקומית
 * מוקדמת מ־unlockTime. כך יום N נמשך מ־05:00 בתאריך start+N-1 עד 05:00 שאחריו.
 */
export function challengeDate(instant: Date, s: Schedule): string {
  const date = localDate(instant, s.timeZone);
  return localMinutes(instant, s.timeZone) >= parseHHMM(s.unlockTime)
    ? date
    : addDays(date, -1);
}

/** מספר היום של האתגר ברגע נתון (או לפני התחלה / אחרי הסוף). */
export function dayStatusAt(instant: Date, s: Schedule): DayStatus {
  const n = diffDays(s.startDate, challengeDate(instant, s)) + 1;
  if (n < 1) return { phase: "before_start" };
  if (n > s.totalDays) return { phase: "ended" };
  return { phase: "active", day: n };
}

/** התאריך המקומי ש"שייך" ליום N (תאריך הפתיחה שלו). */
export function dayDate(day: number, s: Schedule): string {
  assertDay(day, s);
  return addDays(s.startDate, day - 1);
}

/** הרגע שבו יום N נפתח. */
export function unlockInstant(day: number, s: Schedule): Date {
  return zonedTimeToInstant(dayDate(day, s), s.unlockTime, s.timeZone);
}

/** הימים שנפתחו עד הרגע הנתון (ריק לפני ההתחלה, 1..14 אחרי הסוף). */
export function unlockedDays(instant: Date, s: Schedule): number[] {
  const st = dayStatusAt(instant, s);
  if (st.phase === "before_start") return [];
  const last = st.phase === "active" ? st.day : s.totalDays;
  return Array.from({ length: last }, (_, i) => i + 1);
}

export function isDayUnlocked(day: number, instant: Date, s: Schedule): boolean {
  assertDay(day, s);
  return instant.getTime() >= unlockInstant(day, s).getTime();
}

export function isLiveDay(day: number): boolean {
  return (CHALLENGE.liveDays as readonly number[]).includes(day);
}

export function assertDay(day: number, s: Pick<Schedule, "totalDays">): void {
  if (!Number.isInteger(day) || day < 1 || day > s.totalDays) {
    throw new RangeError(`day out of range: ${day}`);
  }
}
