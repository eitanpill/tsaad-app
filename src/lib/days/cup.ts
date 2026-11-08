import { isLiveDay } from "./schedule";

export const ACTIONS = ["habit", "move", "meditate", "live"] as const;
export type Action = (typeof ACTIONS)[number];

export const MAX_STEPS = 3;

/** הפעולות הקיימות ביום: ביום לייב הרגל + לייב, אחרת הרגל, תנועה ומדיטציה. */
export function actionsForDay(day: number): readonly Action[] {
  return isLiveDay(day) ? ["habit", "live"] : ["habit", "move", "meditate"];
}

export function isActionValidForDay(day: number, action: Action): boolean {
  return actionsForDay(day).includes(action);
}

/** ערך הפעולה בצעדים. הלייב נספר כשני צעדים. */
export function stepsForAction(action: Action): number {
  return action === "live" ? 2 : 1;
}

/** צעדים 0..3 מתוך הפעולות שסומנו (פעולות לא תקפות ליום מתעלמים מהן, כפילויות נספרות פעם אחת). */
export function stepsFor(day: number, done: Iterable<Action>): number {
  const valid = new Set(actionsForDay(day));
  let steps = 0;
  for (const a of new Set(done)) {
    if (valid.has(a)) steps += stepsForAction(a);
  }
  return Math.min(MAX_STEPS, steps);
}

export type CupLevel = "empty" | "half" | "three_quarters" | "full";

export function cupLevel(steps: number): CupLevel {
  const s = Math.max(0, Math.min(MAX_STEPS, Math.floor(steps)));
  return (["empty", "half", "three_quarters", "full"] as const)[s];
}

/** יום נספר מצעד אחד ומעלה. */
export function dayCounts(steps: number): boolean {
  return steps >= 1;
}
