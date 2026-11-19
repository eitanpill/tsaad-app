import { copy } from "@/content/copy.he";
import { DAYS } from "@/content/days";
import { EVENING } from "@/config/constants";
import { isLiveDay } from "@/lib/days/schedule";

/** ללא server-only: מיפוי טהור שנבדק ביחידה. */
export type EveningVariant = "open" | "done" | "last";
export type EveningContent = { variant: EveningVariant; habit?: string; practice?: string };

/**
 * תוכן תזכורת הערב ליום N לפי השלמה (יום נספר = צעד אחד לפחות, ראו dayCounts):
 *  - יום 0 (הערב שלפני ההתחלה): done, רק חלק המחר.
 *  - 1..13: open (לא הושלם, תזכורת + מחר) או done (הושלם, רק מחר).
 *  - 14: last (לא הושלם, רק תזכורת, בלי מחר); הושלם: null (לא שולחים כלום).
 *  - מחוץ ל־0..14: null.
 * ההרגל של מחר מ־DAYS[N+1]; התרגול הוא כותרת התנועה, ובמחר של יום לייב (7, 14) נוסח הלייב.
 */
export function eveningContent(day: number, completed: boolean): EveningContent | null {
  if (!Number.isInteger(day) || day < EVENING.firstDay || day > EVENING.lastDay) return null;
  if (day === EVENING.lastDay) return completed ? null : { variant: "last" };
  const tomorrow = DAYS.find((d) => d.day === day + 1);
  if (!tomorrow) return null;
  const habit = tomorrow.habit.title;
  const practice = isLiveDay(tomorrow.day) ? copy.evening.liveTomorrowPractice : tomorrow.movement.title;
  const variant: EveningVariant = day === 0 || completed ? "done" : "open";
  return { variant, habit, practice };
}
