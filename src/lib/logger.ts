import "server-only";
/**
 * לוגר מובנה (JSON שורה לשורה) עם הסתרת שדות רגישים, רקורסיבית.
 * מפתח שהשם שלו מכיל אחת מהמילים הבאות מוחלף ב־"[REDACTED]".
 * גם ערכי מחרוזת חופשיים עוברים ניקוי של URL, דוא"ל, טלפון ו־Bearer.
 */
const SENSITIVE_KEY =
  /pass(word|wd)?|token|secret|cookie|auth|session|credential|signature|api[_-]?key|private|hash|email|phone|mobile|url|uri|endpoint|p256dh|dsn|connection/i;
/** מפתחות קצרים שאי אפשר לחפש כתת־מחרוזת (למשל "ip" בתוך "description"). */
const SENSITIVE_EXACT = /^(ip|ip_?addr(ess)?|x-forwarded-for|x-real-ip|key|name|first_?name|last_?name|full_?name|display_?name)$/i;

const isSensitiveKey = (k: string) => SENSITIVE_KEY.test(k) || SENSITIVE_EXACT.test(k);

export const REDACTED = "[REDACTED]";

const MAX_DEPTH = 8;

export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactText(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  }
  if (seen.has(value)) return "[Circular]";
  if (value instanceof Error) {
    // רק שם והודעה (מנוקה). לא מעתיקים שדות נוספים (למשל detail של pg שמכיל ערכים).
    const out: Record<string, unknown> = {
      name: value.name,
      message: redactText(String(value.message)),
    };
    if (value.cause !== undefined && depth + 1 < MAX_DEPTH) {
      seen.add(value);
      out.cause = redact(value.cause, depth + 1, seen);
    }
    return out;
  }
  if (depth >= MAX_DEPTH) return "[MaxDepth]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((v) => redact(v, depth + 1, seen));
  }
  if (value instanceof Map || value instanceof Set) return `[${value.constructor.name}]`;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return "[Binary]";
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = isSensitiveKey(k) ? REDACTED : redact(v, depth + 1, seen);
  }
  return out;
}

/** מסתיר כתובות (כל סכמה, כולל postgres://), דוא"ל, Bearer וטלפונים בתוך טקסט חופשי. */
export function redactText(text: string): string {
  return text
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, REDACTED)
    .replace(/[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[^\s@<>()"',;:]+/g, REDACTED)
    .replace(/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, REDACTED)
    .replace(/(?<![\w-])(?:\+972|0)(?:[\s-]?\d){8,9}(?![\w-])/g, REDACTED)
    .replace(/(?<![\w-])\+\d(?:[\s-]?\d){7,14}(?![\w-])/g, REDACTED);
}

export type LogLevel = "debug" | "info" | "warn" | "error";
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogSink = (line: string) => void;

export type Logger = {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
};

export function createLogger(
  opts: {
    level?: LogLevel;
    sink?: LogSink;
    base?: Record<string, unknown>;
    now?: () => Date;
  } = {},
): Logger {
  const level = opts.level ?? "info";
  const now = opts.now ?? (() => new Date());
  const sink: LogSink =
    opts.sink ?? ((line) => process.stdout.write(line + "\n"));
  const base = opts.base ?? {};

  const emit = (l: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    if (ORDER[l] < ORDER[level]) return;
    let line: string;
    try {
      // השדות קודם, כדי ששדה בשם time/level/msg לא יוכל לזייף את הרשומה.
      line = JSON.stringify({
        ...(redact({ ...base, ...fields }) as Record<string, unknown>),
        time: now().toISOString(),
        level: l,
        msg: redactText(String(msg)),
      });
    } catch {
      // לוג לעולם לא מפיל בקשה (למשל getter שזורק).
      line = JSON.stringify({ time: now().toISOString(), level: l, msg: redactText(String(msg)), logError: true });
    }
    sink(line);
  };

  return {
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
    child: (fields) =>
      createLogger({ level, sink, now, base: { ...base, ...fields } }),
  };
}

export const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
});
