import { DAYS } from "@/content/days";
import { isHabitStepHabit } from "./rule";

/**
 * רשימת ההרגלים. מקור הרשימה כרגע: days[n].habit.title. כשבעל האתר ימסור רשימה משלו, מחליפים רק את getHabitTitle.
 * שרת בלבד: מייבא את תוכן כל הימים, ולכן אסור לייבא אותו מרכיב לקוח (כותרות של ימים נעולים לא נשלחות לדפדפן).
 */
export function getHabitTitle(habitDay: number): string {
  return DAYS[habitDay - 1].habit.title;
}

export type HabitItem = {
  /** היום שבו ההרגל נוסף (1..14); גם מספרו ברשימה. */
  habitDay: number;
  title: string;
  /** ההרגל החדש של היום (מסומן "חדש היום"). */
  isNew: boolean;
  /** הוא שלב ה"הרגל" הקיים (ראו rule.ts). */
  isStep: boolean;
};

/** ההרגלים 1..day, לפי הסדר. ביום N: N הרגלים; ההרגל האחרון הוא החדש. */
export function getHabitList(day: number): HabitItem[] {
  if (!Number.isInteger(day) || day < 1 || day > DAYS.length) return [];
  const out: HabitItem[] = [];
  for (let d = 1; d <= day; d++) {
    out.push({ habitDay: d, title: getHabitTitle(d), isNew: d === day, isStep: isHabitStepHabit(day, d) });
  }
  return out;
}
