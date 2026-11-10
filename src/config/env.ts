import "server-only";
import { z } from "zod";
import {
  DEFAULT_REMINDER_TIME,
  DEFAULT_TZ_NAME,
  DEFAULT_UNLOCK_TIME,
} from "./constants";

/** מחרוזת ריקה נחשבת כלא הוגדר. */
const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(emptyToUndefined, schema.optional());

const withDefault = (schema: z.ZodString, value: string) =>
  z.preprocess(emptyToUndefined, schema.default(value));

/** רק המחרוזת "true" (בדיוק) היא אמת. כל ערך אחר, כולל "1" ו־"TRUE", הוא שקר. */
const literalBoolean = z.preprocess(
  (v) => v === "true",
  z.boolean(),
);

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM (24h)");

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, "not a real calendar date");

const timeZone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "unknown IANA time zone");

/** https בלבד: כתובות webhook ולייב לא נשלחות בטקסט גלוי. */
const httpsUrl = z
  .url()
  .refine((u) => /^https:\/\//i.test(u), "expected https URL");

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** https, או http רק ל־localhost (פיתוח מקומי). */
const origin = z
  .url()
  .refine((u) => {
    const p = new URL(u);
    return p.protocol === "https:" || (p.protocol === "http:" && LOOPBACK.has(p.hostname));
  }, "expected https origin (http allowed only for localhost)")
  .refine((u) => new URL(u).origin === u, {
    message: "expected an origin without path or trailing slash",
  });

/** תאריך (YYYY-MM-DD, עד סוף אותו יום בשעון ישראל) או רגע מלא עם אזור (ISO 8601). */
const dateOrInstant = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2}))?$/, "expected YYYY-MM-DD or ISO 8601 with offset")
  .refine((s) => !Number.isNaN(new Date(s.length === 10 ? `${s}T00:00:00Z` : s).getTime()), "not a real date");

const utmValue = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/, "letters, digits, _ . - only (max 64)");

/** פרט קשר להצגה (מייל, טלפון או טקסט קצר). */
const contactText = z.string().trim().min(3).max(200);

const posInt = z.coerce.number().int().positive();

export const envSchema = z.object({
  NODE_ENV: optional(z.enum(["development", "test", "production"])),
  DATABASE_URL: optional(z.string().min(1)),
  APP_ORIGIN: optional(origin),

  SESSION_SECRET: optional(z.string().min(32, "at least 32 characters")),
  GHL_WEBHOOK_SECRET: optional(z.string().min(32, "at least 32 characters")),
  CRON_SECRET: optional(z.string().min(16)),
  GHL_WEBHOOK_URL: optional(httpsUrl),

  TRACKER_SYNC_ENABLED: literalBoolean.default(false),
  REMINDERS_ENABLED: literalBoolean.default(false),
  /** לסמוך על x-real-ip / x-forwarded-for מחוץ ל־Vercel (רק מאחורי proxy שדורס אותן). */
  TRUST_PROXY_IP_HEADERS: literalBoolean.default(false),

  BUNNY_LIBRARY_ID: optional(z.string().min(1)),
  BUNNY_TOKEN_KEY: optional(z.string().min(1)),
  /** מזהי הסרטונים של ימים 1..14, מופרדים בפסיקים לפי הסדר; מקום ריק = אין עדיין סרטון ליום. */
  BUNNY_VIDEO_IDS: optional(
    z
      .string()
      .regex(/^([A-Za-z0-9_-]*,){0,13}[A-Za-z0-9_-]*$/, "up to 14 comma-separated ids"),
  ),

  VAPID_PUBLIC_KEY: optional(z.string().min(1)),
  VAPID_PRIVATE_KEY: optional(z.string().min(1)),
  VAPID_SUBJECT: optional(
    z.string().regex(/^(mailto:.+@.+|https:\/\/.+)$/, "mailto: or https: URL"),
  ),

  START_DATE: optional(isoDate),
  UNLOCK_HOUR: withDefault(hhmm, DEFAULT_UNLOCK_TIME),
  REMINDER_TIME: withDefault(hhmm, DEFAULT_REMINDER_TIME),
  TZ_NAME: withDefault(timeZone, DEFAULT_TZ_NAME),

  LIVE_URL_DAY7: optional(httpsUrl),
  LIVE_URL_DAY14: optional(httpsUrl),
  LIVE_TIME_DAY7: optional(hhmm),
  LIVE_TIME_DAY14: optional(hhmm),

  ACTIVATION_LINK_TTL_MINUTES: optional(posInt),
  /** מגבלת מקומות אמיתית בלבד. אם לא הוגדרה, אין מגבלה. */
  SESSION_SPOTS: optional(posInt),
  /** כמה שעות ההצעה פתוחה מסוף הלייב של יום 14. בלעדיו (או בלי LIVE_TIME_DAY14) ההצעה לא נפתחת. */
  OFFER_WINDOW_HOURS: optional(posInt),

  /** קישורי תשלום (Morning). לא הוגדר = הכפתור מוצג כלא פעיל. https בלבד. השמות הם מצייני המקום מהקופי. */
  MORNING_URL_CHALLENGE_79: optional(httpsUrl),
  MORNING_URL_SESSION_271: optional(httpsUrl),
  MORNING_URL_BUNDLE_139: optional(httpsUrl),
  MORNING_URL_YESODOT_1265: optional(httpsUrl),
  /** ערך utm_campaign לכל הצעה (מצייני המקום [UTM_SESSION] ו־[UTM_YESODOT]). */
  OFFER_UTM_SESSION: optional(utmValue),
  OFFER_UTM_BUNDLE: optional(utmValue),
  OFFER_UTM_YESODOT: optional(utmValue),
  /** סוף התוקף של "יסודות היוגה" ([YESODOT_OFFER_EXPIRY]). לא הוגדר = שורה ניטרלית בלי תאריך. */
  YESODOT_OFFER_EXPIRY: optional(dateOrInstant),

  /** פרטי קשר בדפים המשפטיים ([ACCESSIBILITY_CONTACT], [PRIVACY_CONTACT]). לא הוגדר = שורה ניטרלית. */
  ACCESSIBILITY_CONTACT: optional(contactText),
  PRIVACY_CONTACT: optional(contactText),
  /** [SUPPORT_CONTACT]: פרט הקשר הכללי בתנאי השימוש. */
  SUPPORT_CONTACT: optional(contactText),
});

export type Env = z.infer<typeof envSchema>;

/** מנתח מקור סביבה. זורק שגיאה שמפרטת שמות שדות בלבד, לא ערכים. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${problems}`);
  }
  return result.data;
}
