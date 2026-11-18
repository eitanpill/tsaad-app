import { DAYS, type ActionType } from "@/content/days";
import { unlockInstant, type Schedule } from "@/lib/days";
import type { DayTitles } from "@/app/(app)/today/action-labels";

/**
 * כותרות הפעולות של יום אחד. לשימוש בשרת בלבד, ורק ליום שנפתח: אסור לייבא את זה מרכיב לקוח,
 * כי אז כל כותרות 14 הימים (גם של ימים נעולים) יגיעו לדפדפן.
 */
export function dayTitles(day: number): DayTitles {
  const d = DAYS[day - 1];
  const details: Partial<Record<ActionType, string>> = {};
  if (d.habit.detail) details.habit = d.habit.detail;
  if (d.movement.detail) details.move = d.movement.detail;
  if (d.meditation.detail) details.meditate = d.meditation.detail;
  return { habit: d.habit.title, move: d.movement.title, meditate: d.meditation.title, details };
}

/** משפט הפתיחה בצילום של יום אחד. אותו כלל: רק ליום שנפתח. */
export function dayOpening(day: number): string {
  return DAYS[day - 1].opening;
}

/** סוף משפט הפתיחה, הזמנה להתחיל ("קחו נשימה אחת איתי, ומתחילים."). מתאים רק לפני שמתחילים את היום. */
export const OPENING_INVITE = "קחו נשימה אחת איתי, ומתחילים.";

/** משפט הפתיחה בלי ההזמנה: "יום N. ההרגל של היום: ...". לימים שעברו, לערב, ואחרי שכבר סימנו. */
export function dayOpeningLead(day: number): string {
  const full = dayOpening(day);
  return full.endsWith(OPENING_INVITE) ? full.slice(0, -OPENING_INVITE.length).trimEnd() : full;
}

const UNLOCK_FMT = new Map<string, Intl.DateTimeFormat>();
/** "יום שבת, 12 בדצמבר": התאריך שבו יום N נפתח, לפי START_DATE ושעון האתגר. */
export function formatUnlockDate(day: number, s: Schedule): string {
  let f = UNLOCK_FMT.get(s.timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: s.timeZone });
    UNLOCK_FMT.set(s.timeZone, f);
  }
  return f.format(unlockInstant(day, s));
}
