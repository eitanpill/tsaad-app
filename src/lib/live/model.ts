import { CHALLENGE, LIVE } from "@/config/constants";
import { dayDate, dayStatusAt, type Schedule } from "@/lib/days";
import { addDays, zonedTimeToInstant } from "@/lib/time/zone";

/** ללא server-only: מודל טהור שנבדק עם שעון מדומה. הקישור והשעה מגיעים מהתצורה (lib/live/config.ts); אין ערכי ברירת מחדל. */
export type LiveDay = 7 | 14;
export const LIVE_DAYS = CHALLENGE.liveDays as readonly LiveDay[];

export type LiveInput = { time?: string; url?: string };

/**
 * before: עוד לפני חלון הקישור (או שאי אפשר לדעת, כי אין שעה); open: חלון הקישור פתוח; passed: המפגש הסתיים.
 */
export type LiveState = "before" | "open" | "passed";

export type LiveSession = {
  day: LiveDay;
  /** "HH:MM" מהתצורה, או null (אין שעה מוגדרת, ולא ממציאים). */
  time: string | null;
  /** רגע תחילת המפגש. דורש גם תאריך התחלה (START_DATE) וגם שעה; אחרת null. */
  startsAt: Date | null;
  state: LiveState;
  opensAt: Date | null;
  closesAt: Date | null;
  /**
   * הקישור, רק כש־state הוא open. בכל מצב אחר הוא null: הערך אף פעם לא עובר ללקוח לפני חלון הקישור
   * ולא אחריו (הקריאה לפונקציה היא בשרת, והדף מרנדר אותו רק מכאן).
   */
  joinUrl: string | null;
  /** החלון פתוח אבל לא הוגדר קישור (תצורה חסרה). */
  linkMissing: boolean;
  /** אפשר ליצור קובץ יומן: דורש תאריך ושעה. */
  calendarAvailable: boolean;
  /** הרגע הבא שבו המצב של המפגש משתנה, או null. */
  nextChange: Date | null;
};

export function sessionStart(day: LiveDay, schedule: Schedule | null, time: string | undefined): Date | null {
  if (!schedule || !time) return null;
  return zonedTimeToInstant(dayDate(day, schedule), time, schedule.timeZone);
}

const MIN = 60_000;

/**
 * מצב מפגש ברגע נתון.
 *  - שעה ותאריך ידועים: before עד שעה (LIVE.linkOpensBeforeMinutes) לפני, open עד LIVE.linkOpenAfterStartMinutes אחרי התחלה, אחר כך passed.
 *  - בלי שעה: אי אפשר לדעת מתי החלון, לכן הקישור לא מוצג בכלל. המפגש נחשב passed רק אחרי שהיום שלו הסתיים
 *    (היום הבא נפתח), ולפני כן before.
 */
export function liveSession(
  day: LiveDay,
  now: Date,
  schedule: Schedule | null,
  input: LiveInput,
): LiveSession {
  const time = input.time ?? null;
  const startsAt = sessionStart(day, schedule, input.time);
  const base = {
    day,
    time,
    startsAt,
    calendarAvailable: startsAt !== null,
    joinUrl: null as string | null,
    linkMissing: false,
  };

  if (startsAt) {
    const opensAt = new Date(startsAt.getTime() - LIVE.linkOpensBeforeMinutes * MIN);
    const closesAt = new Date(startsAt.getTime() + LIVE.linkOpenAfterStartMinutes * MIN);
    const t = now.getTime();
    if (t < opensAt.getTime()) return { ...base, state: "before", opensAt, closesAt, nextChange: opensAt };
    if (t < closesAt.getTime()) {
      const joinUrl = input.url ?? null;
      return { ...base, state: "open", opensAt, closesAt, joinUrl, linkMissing: joinUrl === null, nextChange: closesAt };
    }
    return { ...base, state: "passed", opensAt, closesAt, nextChange: null };
  }

  if (!schedule) return { ...base, state: "before", opensAt: null, closesAt: null, nextChange: null };
  // בלי שעה: המפגש "עבר" כשהיום שלו נגמר.
  const dayEnds = zonedTimeToInstant(addDays(dayDate(day, schedule), 1), schedule.unlockTime, schedule.timeZone);
  const st = dayStatusAt(now, schedule);
  const over = st.phase === "ended" || (st.phase === "active" && st.day > day);
  return {
    ...base,
    state: over ? "passed" : "before",
    opensAt: null,
    closesAt: null,
    nextChange: over || now.getTime() >= dayEnds.getTime() ? null : dayEnds,
  };
}

export function liveSessions(
  now: Date,
  schedule: Schedule | null,
  inputs: Record<LiveDay, LiveInput>,
): LiveSession[] {
  return LIVE_DAYS.map((d) => liveSession(d, now, schedule, inputs[d]));
}

/** המפגש שמוצג בגדול: הראשון שלא הסתיים, ואם שניהם הסתיימו, האחרון. */
export function focusSession(sessions: LiveSession[]): LiveSession {
  return sessions.find((s) => s.state !== "passed") ?? sessions[sessions.length - 1];
}

/** הרגע הקרוב שבו משהו במסך הלייב משתנה (פתיחת חלון, סגירתו, סוף יום), או null. */
export function nextLiveChange(sessions: LiveSession[]): Date | null {
  let best: number | null = null;
  for (const s of sessions) {
    if (s.nextChange && (best === null || s.nextChange.getTime() < best)) best = s.nextChange.getTime();
  }
  return best === null ? null : new Date(best);
}

const DATE_FMT = new Map<string, Intl.DateTimeFormat>();
function dateFmt(tz: string) {
  let f = DATE_FMT.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
    DATE_FMT.set(tz, f);
  }
  return f;
}

/** תיאור הזמן להצגה: "יום שני, 7 בדצמבר" (כשיש תאריך) ושעה. null כשאין שעה. */
export function liveWhen(s: LiveSession, tz: string): { datetime: string | null; date: string | null; time: string } | null {
  if (!s.time) return null;
  return {
    datetime: s.startsAt ? s.startsAt.toISOString() : null,
    date: s.startsAt ? dateFmt(tz).format(s.startsAt) : null,
    time: s.time,
  };
}
