import { OFFER } from "@/config/constants";
import { sessionStart, type LiveDay } from "@/lib/live/model";
import type { Schedule } from "@/lib/days";
import { addDays, zonedTimeToInstant } from "@/lib/time/zone";

/** ללא server-only: מודל טהור שנבדק עם שעון מדומה. כל החלטה לפי שעון השרת; אין ספירה לאחור ואין ערכים מומצאים. */

export type OfferInputs = {
  /** "HH:MM" של הלייב ביום 14 (LIVE_TIME_DAY14). */
  liveTime: string | undefined;
  /** OFFER_WINDOW_HOURS. */
  windowHours: number | undefined;
};

/**
 * notYet: עוד לפני סוף הלייב של יום 14, או שחסר נתון בתצורה (לא ממציאים מועד).
 * open: מסוף הלייב ועד opensAt + windowHours.
 * expired: חלון ההצעה הסתיים.
 */
export type OfferState =
  | { state: "notYet"; nextChange: Date | null }
  | { state: "open"; opensAt: Date; deadline: Date; hours: number; nextChange: Date }
  | { state: "expired"; deadline: Date; nextChange: null };

const MIN = 60_000;
const HOUR = 60 * MIN;
const LAST_DAY: LiveDay = 14;

/** סוף הלייב של יום 14, או null אם אי אפשר לדעת (אין תאריך התחלה או שעת לייב). */
export function liveEndsAt(schedule: Schedule | null, liveTime: string | undefined): Date | null {
  const start = sessionStart(LAST_DAY, schedule, liveTime);
  return start ? new Date(start.getTime() + OFFER.liveEndsAfterStartMinutes * MIN) : null;
}

export function offerState(now: Date, schedule: Schedule | null, inputs: OfferInputs): OfferState {
  const opensAt = liveEndsAt(schedule, inputs.liveTime);
  const hours = inputs.windowHours;
  if (!opensAt || !hours || !Number.isInteger(hours) || hours <= 0) return { state: "notYet", nextChange: null };
  const deadline = new Date(opensAt.getTime() + hours * HOUR);
  const t = now.getTime();
  if (t < opensAt.getTime()) return { state: "notYet", nextChange: opensAt };
  if (t < deadline.getTime()) return { state: "open", opensAt, deadline, hours, nextChange: deadline };
  return { state: "expired", deadline, nextChange: null };
}

/** תוקף "יסודות היוגה": תאריך בלבד נחשב עד סוף אותו יום בשעון ישראל; רגע מלא נחשב כפי שהוא. */
export function parseExpiry(raw: string | undefined, tz: string): Date | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = zonedTimeToInstant(addDays(raw, 1), "00:00", tz);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** unset: לא הוגדר (שורה ניטרלית); valid: עד until; expired: עבר. until הוא הרגע הראשון שבו המחיר כבר לא תקף. */
export type Validity = { kind: "unset" } | { kind: "valid"; until: Date } | { kind: "expired"; until: Date };

export function yesodotValidity(now: Date, raw: string | undefined, tz: string): Validity {
  const until = parseExpiry(raw, tz);
  if (!until) return { kind: "unset" };
  return now.getTime() < until.getTime() ? { kind: "valid", until } : { kind: "expired", until };
}

const FMT = new Map<string, Intl.DateTimeFormat>();
/** "יום שני, 7 בדצמבר, 20:00" בשעון ישראל. */
export function formatDeadline(at: Date, tz: string): string {
  let f = FMT.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz });
    FMT.set(tz, f);
  }
  return f.format(at);
}

const DATE_FMT = new Map<string, Intl.DateTimeFormat>();
/** תאריך אחרון שבו המחיר תקף, למשל "7 בדצמבר". עבור תאריך בלבד זה היום עצמו; עבור רגע מלא, היום שבו הוא חל. */
export function formatValidUntil(raw: string, until: Date, tz: string): string {
  let f = DATE_FMT.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", timeZone: tz });
    DATE_FMT.set(tz, f);
  }
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  return f.format(dateOnly ? new Date(until.getTime() - 1) : until);
}
