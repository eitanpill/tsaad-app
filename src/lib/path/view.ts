import { CHALLENGE } from "@/config/constants";
import {
  cupLevel,
  dayCounts,
  dayStatusAt,
  isLiveDay,
  markState,
  type Schedule,
} from "@/lib/days";

/** ללא server-only: טהור, נבדק ביחידות, ומשמש גם את דף השביל וגם את דף היום. */

export type StoneState = "counted" | "today" | "yesterday" | "missed" | "locked";

/** גובה המים בכוסית האבן: צעד אחד חצי, שניים שלושה רבעים, שלושה מלאה. */
export type Fill = 0 | 0.5 | 0.75 | 1;

export type Stone = {
  day: number;
  state: StoneState;
  live: boolean;
  fill: Fill;
  /** לאן האבן מובילה, או null (אבן נעולה רחוקה אינה קישור). */
  href: string | null;
};

export type PathModel = {
  stones: Stone[];
  counted: number;
  completed: boolean;
  /**
   * המצבים שהמקרא מסביר, בסדר קבוע: "נספר" תמיד (זו המטרה), והשאר רק כשיש על השביל אבן במצב הזה.
   * כך אחרי סוף האתגר אין "היום" ו"עוד לא נפתח", ולפני ההתחלה אין "לא נספר".
   */
  legend: StoneState[];
  /** היום שנפתח מחר (הוא היחיד מבין הנעולים שיש לו מסך משלו בשביל), או null. */
  tomorrow: number | null;
};

const LEGEND_ORDER: readonly StoneState[] = ["counted", "today", "yesterday", "missed", "locked"];

const FILL_BY_STEPS: Record<number, Fill> = { 0: 0, 1: 0.5, 2: 0.75, 3: 1 };

export function fillForSteps(steps: number): Fill {
  const level = cupLevel(steps);
  return FILL_BY_STEPS[level === "empty" ? 0 : level === "half" ? 1 : level === "three_quarters" ? 2 : 3];
}

/**
 * מצב האבן, לפי שעון השרת והסימונים. סדר ההכרעה:
 *  1. עוד לא נפתח: locked.
 *  2. היום הנוכחי: today (גם אם כבר סומן; הוא נספר בספירה).
 *  3. סומן לפחות צעד אחד: counted.
 *  4. אתמול ועוד פתוח לסימון (עד חצות): yesterday.
 *  5. אחרת: missed ("לא נספר").
 * אחרי סוף האתגר אין "היום": יום 14 נשאר "אפשר לסמן עד חצות" עד 00:00 של start+15.
 */
export function stoneState(
  day: number,
  steps: number,
  now: Date,
  schedule: Schedule | null,
): StoneState {
  if (!schedule) return "locked";
  const m = markState(day, now, schedule);
  if (!m.ok && m.reason === "locked") return "locked";
  if (m.ok && m.kind === "current") return "today";
  if (dayCounts(steps)) return "counted";
  return m.ok ? "yesterday" : "missed";
}

export function pathModel(
  now: Date,
  schedule: Schedule | null,
  stepsByDay: Readonly<Record<number, number>>,
): PathModel {
  const total = schedule?.totalDays ?? CHALLENGE.totalDays;
  const st = schedule ? dayStatusAt(now, schedule) : null;
  const tomorrow = st && st.phase === "active" && st.day < total ? st.day + 1 : null;

  const stones: Stone[] = [];
  let counted = 0;
  for (let day = 1; day <= total; day++) {
    const steps = stepsByDay[day] ?? 0;
    const state = stoneState(day, steps, now, schedule);
    if (state !== "locked" && dayCounts(steps)) counted++;
    stones.push({
      day,
      state,
      live: isLiveDay(day),
      fill: state === "locked" ? 0 : fillForSteps(steps),
      href:
        state === "today"
          ? "/today"
          : state === "locked"
            ? day === tomorrow
              ? `/day/${day}`
              : null
            : `/day/${day}`,
    });
  }
  return {
    stones,
    counted,
    completed: counted >= CHALLENGE.daysToComplete,
    legend: LEGEND_ORDER.filter((st) => st === "counted" || stones.some((s) => s.state === st)),
    tomorrow,
  };
}

export { parseDayParam } from "./day-param";

export type DayScreen =
  /** היום הנוכחי: מפנים ל־/today (שם נמצא הלוח המלא). */
  | { kind: "today" }
  /** נפתח: תוכן. markable = אתמול ועוד לפני חצות. counted = כבר נספר. */
  | { kind: "open"; markable: boolean; counted: boolean }
  /** נעול. reason קובע את הנוסח. */
  | { kind: "locked"; reason: "before_start" | "tomorrow" | "far" };

export function dayScreen(
  day: number,
  now: Date,
  schedule: Schedule | null,
  steps: number,
): DayScreen {
  if (!schedule) return { kind: "locked", reason: "before_start" };
  const st = dayStatusAt(now, schedule);
  if (st.phase === "before_start") return { kind: "locked", reason: "before_start" };
  const m = markState(day, now, schedule);
  if (!m.ok && m.reason === "locked") {
    return { kind: "locked", reason: st.phase === "active" && day === st.day + 1 ? "tomorrow" : "far" };
  }
  if (m.ok && m.kind === "current") return { kind: "today" };
  return { kind: "open", markable: m.ok, counted: dayCounts(steps) };
}
