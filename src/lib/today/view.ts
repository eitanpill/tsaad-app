import {
  dayStatusAt,
  isLiveDay,
  markState,
  markDeadline,
  unlockInstant,
  actionsForDay,
  type Action,
  type Schedule,
} from "@/lib/days";
import { localMinutes } from "@/lib/time/zone";

/** ללא server-only: משמש גם בשרת וגם ברכיב הלקוח. */
export type Phase = "before_start" | "active" | "ended";

export type GreetingKey = "morning" | "day" | "evening";

/** שעה מקומית: עד 12:00 בוקר, עד 18:00 יום, אחר כך ערב (גם בלילה המאוחר, לפני 05:00). */
export function greetingKey(now: Date, tz: string): GreetingKey {
  const h = Math.floor(localMinutes(now, tz) / 60);
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "day";
  return "evening";
}

/** הכותרת: "הבוקר:" עד 12:00, אחרי זה "היום:". */
export function isMorning(now: Date, tz: string): boolean {
  return localMinutes(now, tz) < 12 * 60;
}

export type TodayModel = {
  phase: Phase;
  /** היום הנוכחי (רק כש־phase = active). */
  day: number | null;
  live: boolean;
  /** יום קודם שעוד אפשר לסמן (עד חצות), אם יש. */
  yesterday: number | null;
};

export function todayModel(now: Date, schedule: Schedule | null): TodayModel {
  if (!schedule) return { phase: "before_start", day: null, live: false, yesterday: null };
  const st = dayStatusAt(now, schedule);
  const day = st.phase === "active" ? st.day : null;
  let yesterday: number | null = null;
  if (st.phase !== "before_start") {
    for (let d = 1; d <= schedule.totalDays; d++) {
      const m = markState(d, now, schedule);
      if (m.ok && m.kind === "yesterday") yesterday = d;
    }
  }
  return { phase: st.phase, day, live: day !== null && isLiveDay(day), yesterday };
}

export const actionKey = (day: number, action: Action) => `${day}:${action}`;

export function doneActionsFor(keys: Iterable<string>, day: number): Action[] {
  const valid = new Set<string>(actionsForDay(day));
  const out: Action[] = [];
  for (const k of keys) {
    const [d, a] = k.split(":");
    if (Number(d) === day && valid.has(a)) out.push(a as Action);
  }
  return out;
}

/** הרגע הקרוב שבו משהו במסך משתנה (פתיחת יום או סגירת חלון סימון), או null. */
export function nextBoundary(now: Date, s: Schedule): Date | null {
  let best: number | null = null;
  const t = now.getTime();
  for (let d = 1; d <= s.totalDays; d++) {
    for (const at of [unlockInstant(d, s), markDeadline(d, s)]) {
      const ms = at.getTime();
      if (ms > t && (best === null || ms < best)) best = ms;
    }
  }
  return best === null ? null : new Date(best);
}
