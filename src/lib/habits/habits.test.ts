import { describe, expect, it } from "vitest";
import { DAYS } from "@/content/days";
import { makeSchedule } from "@/lib/days";
import { getHabitList } from "./list";
import { buildChecklist, habitCount, habitEditability } from "./model";
import { HABIT_STEP_RULE, isHabitStepHabit } from "./rule";

const schedule = makeSchedule("2026-12-01");
const at = (iso: string) => new Date(iso);

describe("getHabitList", () => {
  it("day 1 has one habit, the new one", () => {
    const l = getHabitList(1);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ habitDay: 1, title: DAYS[0].habit.title, isNew: true });
  });

  it("day N has habits 1..N in order, and only the last is new", () => {
    const l = getHabitList(3);
    expect(l.map((h) => h.habitDay)).toEqual([1, 2, 3]);
    expect(l.map((h) => h.title)).toEqual(DAYS.slice(0, 3).map((d) => d.habit.title));
    expect(l.map((h) => h.isNew)).toEqual([false, false, true]);
  });

  it("day 14 has 14 habits and never includes a later day", () => {
    expect(getHabitList(14)).toHaveLength(14);
    expect(getHabitList(5).map((h) => h.title)).not.toContain(DAYS[5].habit.title);
  });

  it("returns nothing for an invalid day", () => {
    for (const d of [0, -1, 15, 1.5, Number.NaN]) expect(getHabitList(d)).toEqual([]);
  });
});

describe("owner's final habit list", () => {
  it("is the exact list, in order, 1..14", () => {
    expect(getHabitList(14).map((h) => h.title)).toEqual([
      "כוס מים חמימים עם לימון כשקמים",
      "לסדר את המיטה מיד כשקמים",
      "חצי שעה בלי טלפון מרגע ההתעוררות",
      "7 דקות אמבטיית שמש",
      "מדרגות במקום מעלית, והליכה במקום נסיעה קצרה",
      "הודעה אחת טובה לאדם שאוהבים",
      "ארוחה אחת בלי מסכים",
      "אכילה קשובה, 3 ביסים ראשונים לאט",
      "כוס מים לפני כל ארוחה, ולפחות 2 ליטר ביום",
      "3 תודות",
      "הטלפון נטען מחוץ לחדר",
      "חצי שעה בלי מסכים לפני השינה",
      "שעת שינה קבועה",
      "לבחור את ההרגלים שממשיכים איתם",
    ]);
  });
});

describe("completion rule (isolated)", () => {
  it("current rule: only the new habit of the day is the habit step", () => {
    expect(HABIT_STEP_RULE).toBe("new_habit");
    expect(isHabitStepHabit(4, 4)).toBe(true);
    expect(isHabitStepHabit(4, 3)).toBe(false);
    expect(isHabitStepHabit(1, 1)).toBe(true);
  });
});

describe("buildChecklist / habitCount", () => {
  const habits = getHabitList(3);
  it("reads the new habit from the step and the others from the older checks", () => {
    const l = buildChecklist(3, habits, true, [1]);
    expect(l.map((i) => i.checked)).toEqual([true, false, true]);
    expect(buildChecklist(3, habits, false, [1, 2]).map((i) => i.checked)).toEqual([true, true, false]);
  });
  it("ignores an older check that is out of range or is the step habit itself", () => {
    expect(buildChecklist(3, habits, false, [3, 9]).map((i) => i.checked)).toEqual([false, false, false]);
    expect(habitCount(3, false, [3, 9, 0, 1])).toEqual({ done: 1, total: 3 });
  });
  it("counts X of N", () => {
    expect(habitCount(1, false, [])).toEqual({ done: 0, total: 1 });
    expect(habitCount(1, true, [])).toEqual({ done: 1, total: 1 });
    expect(habitCount(5, true, [1, 2, 4])).toEqual({ done: 4, total: 5 });
  });
});

describe("habitEditability follows the existing marking rules", () => {
  // day 4 noon: 4 is today, 3 is yesterday, 2 is closed, 5 is locked
  const noon4 = at("2026-12-04T14:00:00+02:00");
  it("today and yesterday are editable, older read-only, future locked", () => {
    expect(habitEditability(4, noon4, schedule)).toBe("editable");
    expect(habitEditability(3, noon4, schedule)).toBe("editable");
    expect(habitEditability(2, noon4, schedule)).toBe("readonly");
    expect(habitEditability(1, noon4, schedule)).toBe("readonly");
    expect(habitEditability(5, noon4, schedule)).toBe("locked");
  });
  it("yesterday closes at midnight", () => {
    expect(habitEditability(3, at("2026-12-04T23:59:00+02:00"), schedule)).toBe("editable");
    expect(habitEditability(3, at("2026-12-05T00:00:00+02:00"), schedule)).toBe("readonly");
  });
  it("no schedule or an invalid day is locked", () => {
    expect(habitEditability(1, noon4, null)).toBe("locked");
    expect(habitEditability(0, noon4, schedule)).toBe("locked");
    expect(habitEditability(15, noon4, schedule)).toBe("locked");
  });
});
