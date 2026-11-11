import { CHALLENGE } from "@/config/constants";
import { cupLevel, dayCounts } from "@/lib/days";

/** ללא server-only: טהור, ומשמש גם את מסך הסיום וגם את כרטיס השיתוף. */

export type FinishSummary = {
  /** הימים שנספרו, בסדר עולה. */
  countedDays: number[];
  /** מסכת ביטים של הימים שנספרו (ביט d-1 = יום d), לכתובת של כרטיס השיתוף. */
  mask: number;
  /** כמה ימים נגמרו בכוס מלאה, בשלושה רבעים ובחצי כוס. */
  cups: { full: number; threeQuarters: number; half: number };
};

export function finishSummary(
  stepsByDay: Readonly<Record<number, number>>,
  total: number = CHALLENGE.totalDays,
): FinishSummary {
  const countedDays: number[] = [];
  const cups = { full: 0, threeQuarters: 0, half: 0 };
  let mask = 0;
  for (let d = 1; d <= total; d++) {
    const steps = stepsByDay[d] ?? 0;
    if (!dayCounts(steps)) continue;
    countedDays.push(d);
    mask |= 1 << (d - 1);
    const level = cupLevel(steps);
    if (level === "full") cups.full++;
    else if (level === "three_quarters") cups.threeQuarters++;
    else cups.half++;
  }
  return { countedDays, mask, cups };
}

/** פענוח ערך ה־m בכתובת הכרטיס: מספר שלם בין 0 ל־2^14-1, אחרת null. מחזיר את רשימת הימים שנספרו. */
export function daysFromMask(raw: string | null, total: number = CHALLENGE.totalDays): number[] | null {
  if (raw === null || !/^\d{1,5}$/.test(raw)) return null;
  const m = Number(raw);
  if (!Number.isInteger(m) || m < 0 || m >= 1 << total) return null;
  const out: number[] = [];
  for (let d = 1; d <= total; d++) if (m & (1 << (d - 1))) out.push(d);
  return out;
}
