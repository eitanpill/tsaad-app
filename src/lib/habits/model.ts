import { markState, type Schedule } from "@/lib/days";
import { isHabitStepHabit } from "./rule";

/** ללא server-only: טהור, נבדק ביחידות, ומשמש גם את השרת וגם את הלקוח. */

export type ChecklistItem = {
  habitDay: number;
  title: string;
  isNew: boolean;
  checked: boolean;
};

/**
 * מאחד את שני המקורות לרשימה אחת לתצוגה: ההרגל שהוא שלב ה"הרגל" נקרא מהסימון הקיים של השלב (stepDone),
 * וכל השאר מ־olderChecked (habit_checks של היום הזה). מספרי הרגלים מחוץ ל־1..day מתעלמים.
 */
export function buildChecklist(
  day: number,
  habits: ReadonlyArray<{ habitDay: number; title: string }>,
  stepDone: boolean,
  olderChecked: Iterable<number>,
): ChecklistItem[] {
  const older = new Set(olderChecked);
  return habits
    .filter((h) => h.habitDay >= 1 && h.habitDay <= day)
    .map((h) => ({
      habitDay: h.habitDay,
      title: h.title,
      isNew: h.habitDay === day,
      checked: isHabitStepHabit(day, h.habitDay) ? stepDone : older.has(h.habitDay),
    }));
}

/** "X מתוך N הרגלים" ליום אחד. */
export function habitCount(day: number, stepDone: boolean, olderChecked: Iterable<number>): { done: number; total: number } {
  const older = new Set<number>();
  for (const h of olderChecked) if (Number.isInteger(h) && h >= 1 && h <= day && !isHabitStepHabit(day, h)) older.add(h);
  return { done: older.size + (stepDone ? 1 : 0), total: day };
}

export type HabitEditability = "editable" | "readonly" | "locked";

/**
 * אותם כללים בדיוק כמו סימון פעולות (markState): היום הנוכחי ואתמול עד חצות ניתנים לעריכה; ימים ישנים יותר לקריאה בלבד;
 * יום שעוד לא נפתח (או אתגר בלי לוח) נעול.
 */
export function habitEditability(day: number, now: Date, schedule: Schedule | null): HabitEditability {
  if (!schedule || !Number.isInteger(day) || day < 1 || day > schedule.totalDays) return "locked";
  const m = markState(day, now, schedule);
  if (m.ok) return "editable";
  return m.reason === "locked" ? "locked" : "readonly";
}
