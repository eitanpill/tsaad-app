/**
 * לוגר מובנה (JSON שורה לשורה) עם הסתרת שדות רגישים, רקורסיבית.
 * מפתח שהשם שלו מכיל אחד מהמילים הבאות מוחלף ב־"[REDACTED]".
 */
const SENSITIVE_KEY = /password|token|secret|cookie|authorization|email|phone|url/i;

export const REDACTED = "[REDACTED]";

const MAX_DEPTH = 8;

export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") {
    return typeof value === "bigint" ? value.toString() : value;
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    // הודעת שגיאה עלולה להכיל נתונים רגישים, לכן נשמר רק השם.
    return { name: value.name, message: redactText(value.message) };
  }
  if (seen.has(value)) return "[Circular]";
  if (depth >= MAX_DEPTH) return "[MaxDepth]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((v) => redact(v, depth + 1, seen));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEY.test(k) ? REDACTED : redact(v, depth + 1, seen);
  }
  return out;
}

/** מסתיר כתובות URL ודוא"ל בתוך טקסט חופשי. */
function redactText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, REDACTED)
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, REDACTED);
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
    const record = {
      time: now().toISOString(),
      level: l,
      msg: redactText(msg),
      ...(redact({ ...base, ...fields }) as Record<string, unknown>),
    };
    sink(JSON.stringify(record));
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
