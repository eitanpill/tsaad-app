import { DAYS } from "@/content/days";

/**
 * כותרות הפעולות של יום אחד. לשימוש בשרת בלבד, ורק ליום שנפתח: אסור לייבא את זה מרכיב לקוח,
 * כי אז כל כותרות 14 הימים (גם של ימים נעולים) יגיעו לדפדפן.
 */
export function dayTitles(day: number): { habit: string; move: string; meditate: string } {
  const d = DAYS[day - 1];
  return { habit: d.habit.title, move: d.movement.title, meditate: d.meditation.title };
}
