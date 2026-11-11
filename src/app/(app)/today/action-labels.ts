import { copy } from "@/content/copy.he";
import type { Action } from "@/lib/days";

/** בלי תלות ב־content/days: משמש רכיבי לקוח, ולכן לא יכול לגרור אליהם את כל כותרות 14 הימים. */
export type DayTitles = {
  habit: string;
  move: string;
  meditate: string;
  /** שורה משנית אופציונלית מתחת לכותרת (למשל יום 13, מדיטציה). */
  details?: { habit?: string; move?: string; meditate?: string };
};

export const TYPE_LABEL = (a: Action): string => (a === "live" ? copy.today.liveAction : copy.common.actionTypes[a]);

export function actionTitle(titles: DayTitles, a: Action): string {
  return a === "live" ? "" : titles[a];
}

export function actionDetail(titles: DayTitles, a: Action): string | undefined {
  return a === "live" ? undefined : titles.details?.[a];
}
