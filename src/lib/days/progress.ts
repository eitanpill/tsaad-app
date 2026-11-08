import { CHALLENGE } from "@/config/constants";
import { dayCounts } from "./cup";
import { markState } from "./marking";
import { assertDay, type Schedule } from "./schedule";

export type Progress = {
  counted: number;
  /** כמה ימים חסרים להשלמה (0 כשהושלם). */
  remaining: number;
  completed: boolean;
  /** ימים שעוד אפשר לספור: עדיין לא נספרו, ופתוחים לסימון או שטרם נפתחו. */
  daysLeft: number;
  /** האם עדיין אפשר להגיע ל־12. אם לא, ה־UI מציג copy.today.remaining.unreachable. */
  isCompletionReachable: boolean;
};

/**
 * @param stepsByDay מספר צעדים (0..3) לכל יום; יום חסר = 0.
 * @param instant הרגע הנוכחי (מעביר את הלוגיקה לקביעת מה עוד פתוח).
 */
export function computeProgress(
  stepsByDay: Readonly<Record<number, number>>,
  instant: Date,
  s: Schedule,
  daysToComplete: number = CHALLENGE.daysToComplete,
): Progress {
  let counted = 0;
  let daysLeft = 0;
  for (let day = 1; day <= s.totalDays; day++) {
    assertDay(day, s);
    if (dayCounts(stepsByDay[day] ?? 0)) {
      counted++;
      continue;
    }
    const st = markState(day, instant, s);
    if (st.ok || st.reason === "locked") daysLeft++;
  }
  const remaining = Math.max(0, daysToComplete - counted);
  return {
    counted,
    remaining,
    completed: counted >= daysToComplete,
    daysLeft,
    isCompletionReachable: counted >= daysToComplete || counted + daysLeft >= daysToComplete,
  };
}
