import "server-only";
import { CHALLENGE } from "./constants";
import { parseEnv, type Env } from "./env";

export { CHALLENGE } from "./constants";

export type AppConfig = Readonly<{
  challenge: typeof CHALLENGE;
  env: Readonly<Env>;
  /** שעת פתיחת יום והתזכורת בפועל (ברירת המחדל מהקבועים). */
  unlockTime: string;
  reminderTime: string;
  timeZone: string;
  startDate: string | undefined;
}>;

export function buildConfig(
  source: Record<string, string | undefined>,
): AppConfig {
  const env = Object.freeze(parseEnv(source));
  return Object.freeze({
    challenge: CHALLENGE,
    env,
    unlockTime: env.UNLOCK_HOUR,
    reminderTime: env.REMINDER_TIME,
    timeZone: env.TZ_NAME,
    startDate: env.START_DATE,
  });
}

let cached: AppConfig | undefined;

/** טעינה עצלה, כדי שבנייה בלי משתני סביבה לא תיכשל. */
export function getConfig(): AppConfig {
  cached ??= buildConfig(process.env);
  return cached;
}

/**
 * מקור הסביבה הגולמי לקוד שצריך גם משתנים שאינם בסכמה (VERCEL) או ערכים כפי שהוגדרו. הקריאה היחידה ל־process.env
 * מחוץ ל־src/config עוברת כאן, אחרי שהסביבה אומתה (getConfig זורק על ערך לא תקין, עם שמות משתנים בלבד).
 */
export function readEnv(): Record<string, string | undefined> {
  getConfig();
  return process.env;
}
