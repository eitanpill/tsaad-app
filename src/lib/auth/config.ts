import "server-only";
/**
 * הגדרות האימות: קבועי מדיניות (הצעות עיצוב, ניתנות לשינוי במקום אחד) וקריאת סודות
 * עם סירוב בפרודקשן ("fail closed"). קבועים אלה אינם סודות.
 */

export const SESSION_POLICY = Object.freeze({
  /** תוקף מוחלט מרגע ההתחברות. הצעה, ניתנת לשינוי. */
  absoluteDays: 30,
  /** חוסר פעילות שמבטל את ההתחברות. הצעה, ניתנת לשינוי. */
  idleDays: 14,
  /** עדכון last_seen_at רק אם עבר יותר מזה, כדי לא לכתוב בכל בקשה. */
  touchEverySeconds: 300,
});

export const RATE_LIMITS = Object.freeze({
  /** ניסיונות התחברות כושלים. */
  login: Object.freeze({ windowSeconds: 15 * 60, perIdentifier: 5, perIp: 30 }),
  /** בקשות "שכחתי סיסמה" (כל בקשה נספרת). */
  forgot: Object.freeze({ windowSeconds: 60 * 60, perIdentifier: 3, perIp: 10 }),
  /** קישורים שנשלחים לאותו חשבון, מכל המזהים יחד (נגד הצפת הודעות). */
  forgotPerAccount: Object.freeze({ windowSeconds: 60 * 60, max: 5 }),
  /** סימוני פעולות (כל קריאה נספרת), לפי משתמש. שימוש רגיל: כמה בודדים ביום. נגד הצפת כתיבות. */
  toggle: Object.freeze({ windowSeconds: 10 * 60, perIdentifier: 60, perIp: 1_000_000 }),
  /** רישום וביטול מנוי התראות (כל קריאה נספרת), לפי משתמש. שימוש רגיל: פעם־פעמיים בחיים של מכשיר. */
  push: Object.freeze({ windowSeconds: 10 * 60, perIdentifier: 20, perIp: 1_000_000 }),
});

/** זמן מינימלי לתגובת "שכחתי סיסמה", כדי שהתזמון לא יגלה אם יש חשבון. */
export const FORGOT_MIN_RESPONSE_MS = 700;
/** הספירה לאחור בכפתור "שליחה מחדש" (הגבלת הקצב בצד שרת היא המחייבת). */
export const RESEND_COOLDOWN_SECONDS = 60;
export const POST_LOGIN_PATH = "/today";

export const MIN_SECRET_BYTES = 32;

type Env = Record<string, string | undefined>;

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigError";
  }
}

export const isProduction = (env: Env = process.env) => env.NODE_ENV === "production";

/** סוד ההפעלה. בפרודקשן: חובה, ולפחות 32 בתים. בפיתוח/בדיקות: חובה גם כן (אין ערך ברירת מחדל). */
export function getSessionSecret(env: Env = process.env): string {
  const secret = env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    throw new AuthConfigError(
      "SESSION_SECRET is missing or shorter than 32 bytes; authentication is disabled.",
    );
  }
  return secret;
}

/** תוקף קישור הפעלה/איפוס בדקות. אין ערך ברירת מחדל בפרודקשן. */
export function getActivationTtlMinutes(env: Env = process.env): number {
  const raw = env.ACTIVATION_LINK_TTL_MINUTES?.trim();
  if (!raw) {
    if (isProduction(env)) {
      throw new AuthConfigError("ACTIVATION_LINK_TTL_MINUTES is not set; refusing to issue links.");
    }
    // פיתוח ובדיקות בלבד.
    return 60;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new AuthConfigError("ACTIVATION_LINK_TTL_MINUTES must be a positive integer.");
  }
  return n;
}

/** ה־origin של האפליקציה. בפרודקשן חובה. בפיתוח, אם חסר, אין אכיפה מול מארח. */
export function getAppOrigin(env: Env = process.env): string | undefined {
  const raw = env.APP_ORIGIN?.trim();
  if (!raw) {
    if (isProduction(env)) throw new AuthConfigError("APP_ORIGIN is not set.");
    return undefined;
  }
  try {
    return new URL(raw).origin;
  } catch {
    throw new AuthConfigError("APP_ORIGIN is not a valid origin.");
  }
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** עוגיית Secure בכל מקום חוץ מפיתוח מקומי (http://localhost). */
export function shouldUseSecureCookies(env: Env = process.env): boolean {
  if (isProduction(env)) return true;
  const origin = env.APP_ORIGIN?.trim();
  if (!origin) return false;
  try {
    const u = new URL(origin);
    return !(u.protocol === "http:" && LOOPBACK.has(u.hostname));
  } catch {
    return true;
  }
}

/** `__Host-` דורש Secure, ולכן בפיתוח מקומי על http משתמשים בשם בלי הקידומת. */
export function sessionCookieName(env: Env = process.env): string {
  return shouldUseSecureCookies(env) ? "__Host-tsaad_session" : "tsaad_session";
}
