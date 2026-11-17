/**
 * כלל ההשלמה של "ההרגלים שלי": איזה הרגל ברשימה הוא שלב ה"הרגל" של היום (זה שממלא את הכוס ונספר ב־12 מתוך 14).
 * ללא server-only וללא תוכן ימים: טהור, ומשמש גם את הלקוח.
 *
 * הכלל הנוכחי (החלטת העיצוב): "new_habit". ההרגל החדש של היום (habitDay === day) הוא שלב ה"הרגל" הקיים, ולכן סימון שלו
 * ברשימה הוא בדיוק סימון השלב (action_completions, כולל סנכרון המעקב). שאר ההרגלים הם לעצמם ולא משפיעים על הכוס או על הספירה.
 *
 * שינוי הכלל בעתיד (בעל האתר יחליט) נעשה כאן בלבד:
 *  - "any" / "all": השלב נגזר מ־habit_checks (ולכן צריך גם לכתוב את שורת ה־action_completions בהתאם, בטרנזקציה, כדי
 *    שהכוס, הספירה והסנכרון ימשיכו לקרוא מקור אחד). ראו toggleHabitCheckCore ב־checks.ts, המקום היחיד שמפעיל את הכלל.
 */
export type HabitStepRule = "new_habit";

export const HABIT_STEP_RULE: HabitStepRule = "new_habit";

/** האם ההרגל הזה (לפי היום שבו נוסף) הוא שלב ה"הרגל" של היום הנתון, לפי הכלל הנוכחי. */
export function isHabitStepHabit(day: number, habitDay: number, rule: HabitStepRule = HABIT_STEP_RULE): boolean {
  switch (rule) {
    case "new_habit":
      return habitDay === day;
  }
}
