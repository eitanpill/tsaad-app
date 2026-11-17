import { OFFER } from "@/config/constants";
import { sessionStart, type LiveDay } from "@/lib/live/model";
import type { Schedule } from "@/lib/days";

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

/** חלון ההצעה של יום 14: מסוף הלייב ועד OFFER_WINDOW_HOURS אחריו, או null אם חסר נתון (לא ממציאים מועד). מקור יחיד גם ל־offerState וגם ל־"יסודות היוגה". */
export function offerWindow(schedule: Schedule | null, inputs: OfferInputs): { opensAt: Date; deadline: Date; hours: number } | null {
  const opensAt = liveEndsAt(schedule, inputs.liveTime);
  const hours = inputs.windowHours;
  if (!opensAt || !hours || !Number.isInteger(hours) || hours <= 0) return null;
  return { opensAt, deadline: new Date(opensAt.getTime() + hours * HOUR), hours };
}

export function offerState(now: Date, schedule: Schedule | null, inputs: OfferInputs): OfferState {
  const w = offerWindow(schedule, inputs);
  if (!w) return { state: "notYet", nextChange: null };
  const { opensAt, deadline, hours } = w;
  const t = now.getTime();
  if (t < opensAt.getTime()) return { state: "notYet", nextChange: opensAt };
  if (t < deadline.getTime()) return { state: "open", opensAt, deadline, hours, nextChange: deadline };
  return { state: "expired", deadline, nextChange: null };
}

/**
 * תוקף "יסודות היוגה": אותו חלון של יום 14 (48 שעות מסוף האתגר, החלטת פית 2026-11-11).
 * unset: אי אפשר לחשב עדיין (חסר START_DATE, LIVE_TIME_DAY14 או OFFER_WINDOW_HOURS); valid: עד until (גם לפני יום 14); expired: עבר.
 * until הוא הרגע הראשון שבו המחיר כבר לא תקף.
 */
export type Validity = { kind: "unset" } | { kind: "valid"; until: Date } | { kind: "expired"; until: Date };

export function yesodotValidity(now: Date, schedule: Schedule | null, inputs: OfferInputs): Validity {
  const w = offerWindow(schedule, inputs);
  if (!w) return { kind: "unset" };
  return now.getTime() < w.deadline.getTime() ? { kind: "valid", until: w.deadline } : { kind: "expired", until: w.deadline };
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
