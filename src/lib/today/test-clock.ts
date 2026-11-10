/**
 * שעון בדיקות, ל־e2e ולבדיקות ידניות מקומיות בלבד. אסור שיהיה לו אפקט בפרודקשן.
 *
 * מנגנון: משתנה הסביבה TSAAD_TEST_NOW (רגע ISO) קובע את "עכשיו". כשהמנגנון מופעל, הכותרת
 * x-tsaad-test-now יכולה לדרוס אותו לבקשה בודדת (כך ריצת שרת אחת משרתת הרבה מצבים), אבל רק אם הבקשה
 * נושאת גם x-tsaad-test-key ששווה ל־TSAAD_TEST_CLOCK_KEY (32 תווים לפחות, נוצר אקראית לכל ריצת e2e).
 * כך גם פריסה שהוגדרה בטעות עם TSAAD_E2E ו־APP_ORIGIN מקומי לא מקבלת שעון מכותרת של זר.
 *
 * ההגנה ("ignored in production"), כולה ב־testClockAllowed:
 *  1. כל סביבת Vercel (VERCEL או VERCEL_ENV מוגדרים) דוחה, תמיד.
 *  2. NODE_ENV=production דוחה, אלא אם כל התנאים האלה מתקיימים יחד: TSAAD_E2E=1 מוגדר במפורש
 *     (רק ב־playwright.config.ts) וגם APP_ORIGIN הוא כתובת loopback (localhost / 127.0.0.1 / [::1]).
 *     פריסה אמיתית אי אפשר להריץ עם APP_ORIGIN כזה (schema הסביבה מתיר http רק ל־loopback, ובדיקת ה־Origin
 *     דוחה כל בקשה מדפדפן אמיתי), והבילד המקומי של ה־e2e הוא `next start` ולכן NODE_ENV=production גם שם.
 *  3. בפיתוח ובבדיקות (NODE_ENV אחר) מותר, אם יש ערך.
 * ערך שאינו תאריך תקין מתעלמים ממנו.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const TEST_CLOCK_ENV = "TSAAD_TEST_NOW";
export const TEST_CLOCK_HEADER = "x-tsaad-test-now";
export const TEST_CLOCK_KEY_HEADER = "x-tsaad-test-key";
export const TEST_CLOCK_KEY_ENV = "TSAAD_TEST_CLOCK_KEY";

type Env = Record<string, string | undefined>;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isLoopbackOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    return (u.protocol === "http:" || u.protocol === "https:") && LOOPBACK_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

export function testClockAllowed(env: Env): boolean {
  if (env.VERCEL || env.VERCEL_ENV) return false;
  if (env.NODE_ENV === "production") {
    return env.TSAAD_E2E === "1" && isLoopbackOrigin(env.APP_ORIGIN);
  }
  return true;
}

function parseInstant(v: string | null | undefined): Date | null {
  if (!v) return null;
  // ISO 8601 עם אזור (Z או היסט), כדי שהערך לא יהיה תלוי באזור הזמן של השרת.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** השוואה בזמן קבוע (sha256 משווה אורכים). */
function sameSecret(a: string, b: string): boolean {
  const h = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(h(a), h(b));
}

/** הכותרת נחשבת רק עם מפתח הריצה הנכון. בלי מפתח מוגדר (או קצר), הכותרת לא נחשבת כלל. */
function headerKeyOk(env: Env, key: string | null | undefined): boolean {
  const expected = env[TEST_CLOCK_KEY_ENV];
  if (!expected || expected.length < 32 || !key) return false;
  return sameSecret(key, expected);
}

/** "עכשיו" של השרת. בלי מנגנון מורשה, תמיד השעון האמיתי. */
export function resolveNow(
  env: Env,
  header: { now?: string | null; key?: string | null } | null,
  real: Date,
): Date {
  if (!testClockAllowed(env)) return real;
  const fromHeader = header && headerKeyOk(env, header.key) ? parseInstant(header.now) : null;
  return fromHeader ?? parseInstant(env[TEST_CLOCK_ENV]) ?? real;
}
