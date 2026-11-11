import { DAYS, type ActionType } from "@/content/days";
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
