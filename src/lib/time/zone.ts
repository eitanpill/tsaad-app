/**
 * עזרי אזור זמן על בסיס Intl בלבד (בלי ספריות).
 * תאריך מקומי מיוצג כמחרוזת "YYYY-MM-DD", שעה מקומית כ־"HH:MM".
 */
export const DEFAULT_TZ = "Asia/Jerusalem";

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      calendar: "gregory",
      numberingSystem: "latn",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** רכיבי הזמן המקומי של רגע נתון. */
export function getZonedParts(instant: Date, tz: string = DEFAULT_TZ): ZonedParts {
  if (Number.isNaN(instant.getTime())) throw new RangeError("invalid instant");
  const out: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(instant)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** התאריך המקומי ("YYYY-MM-DD") של רגע נתון. */
export function localDate(instant: Date, tz: string = DEFAULT_TZ): string {
  const p = getZonedParts(instant, tz);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** דקות מחצות מקומית (0..1439). */
export function localMinutes(instant: Date, tz: string = DEFAULT_TZ): number {
  const p = getZonedParts(instant, tz);
  return p.hour * 60 + p.minute;
}

export function parseHHMM(hhmm: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) throw new RangeError(`bad HH:MM: ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

function parseDate(date: string): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new RangeError(`bad date: ${date}`);
  const r = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  const chk = new Date(Date.UTC(r.y, r.m - 1, r.d));
  if (chk.getUTCFullYear() !== r.y || chk.getUTCMonth() !== r.m - 1 || chk.getUTCDate() !== r.d) {
    throw new RangeError(`bad date: ${date}`);
  }
  return r;
}

/** מוסיף ימי לוח לתאריך מקומי. אריתמטיקה על לוח שנה, לא על 24 שעות. */
export function addDays(date: string, n: number): string {
  const { y, m, d } = parseDate(date);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** מספר ימי לוח בין שני תאריכים (b - a). */
export function diffDays(a: string, b: string): number {
  const pa = parseDate(a);
  const pb = parseDate(b);
  return Math.round(
    (Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000,
  );
}

/**
 * הרגע (UTC) שבו השעון המקומי מראה את התאריך והשעה הנתונים.
 * בשעה שלא קיימת (קפיצת שעון קדימה) מוחזר הזמן ההזזה קדימה בגודל הקפיצה;
 * בשעה כפולה (חזרה אחורה) מוחזר המופע הראשון.
 */
export function zonedTimeToInstant(
  date: string,
  hhmm: string,
  tz: string = DEFAULT_TZ,
): Date {
  const { y, m, d } = parseDate(date);
  const minutes = parseHHMM(hhmm);
  const wallAsUtc = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  const target = wallAsUtc;
  // מועמדים לפי שני היסטים סמוכים; בוחרים את המוקדם שמתאים בדיוק לשעון המקומי.
  const offsetAt = (ms: number) => {
    const p = getZonedParts(new Date(ms), tz);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms;
  };
  const o1 = offsetAt(target - 36e5 * 3);
  const o2 = offsetAt(target + 36e5 * 3);
  const candidates = [...new Set([target - o1, target - o2])].sort((a, b) => a - b);
  for (const c of candidates) {
    if (offsetAt(c) + c === target) return new Date(c);
  }
  // שעה שלא קיימת: הרגע הראשון שאחרי הקפיצה.
  return new Date(Math.max(...candidates));
}
