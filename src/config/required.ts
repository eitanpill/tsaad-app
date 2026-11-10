import { parseEnv } from "./env";

/**
 * בדיקת סביבה בעליית השרת (src/instrumentation.ts), בפרודקשן בלבד ולא בזמן build.
 * - ערכים לא תקינים: parseEnv זורק עם שמות המשתנים בלבד (לא ערכים).
 * - חובה: בלעדיהם אין כניסה, הפעלה או חיבור למסד, ולכן השרת מסרב לעלות עם הודעה ברורה.
 * - מומלץ: כל תכונה בודקת אותם בעצמה ונכשלת סגור (cron 401, webhook 503, סרטון "לא זמין"), ולכן רק אזהרה.
 */
export const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "APP_ORIGIN", "SESSION_SECRET", "ACTIVATION_LINK_TTL_MINUTES"] as const;

export const RECOMMENDED_IN_PRODUCTION = [
  "CRON_SECRET",
  "GHL_WEBHOOK_SECRET",
  "START_DATE",
  "BUNNY_LIBRARY_ID",
  "BUNNY_TOKEN_KEY",
  "BUNNY_VIDEO_IDS",
  "VAPID_PUBLIC_KEY",
  "VAPID_SUBJECT",
  "ACCESSIBILITY_CONTACT",
  "PRIVACY_CONTACT",
] as const;

type Source = Record<string, string | undefined>;
const missing = (src: Source, names: readonly string[]) => names.filter((n) => !src[n]?.trim());

export class EnvConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvConfigError";
  }
}

/** זורק EnvConfigError (שמות בלבד) כשחסר משתנה חובה או שערך לא תקין; מחזיר את רשימת האזהרות. */
export function checkProductionEnv(src: Source): string[] {
  const absent = missing(src, REQUIRED_IN_PRODUCTION);
  if (absent.length) throw new EnvConfigError(`Missing required environment variables: ${absent.join(", ")}`);
  try {
    parseEnv(src);
  } catch (e) {
    throw new EnvConfigError((e as Error).message);
  }
  const warnings: string[] = [];
  const rec = missing(src, RECOMMENDED_IN_PRODUCTION);
  if (rec.length) warnings.push(`not set (the feature stays off or shows a placeholder): ${rec.join(", ")}`);
  if (src.REMINDERS_ENABLED === "true" && (!src.VAPID_PRIVATE_KEY || !src.VAPID_PUBLIC_KEY)) {
    warnings.push("REMINDERS_ENABLED=true without VAPID keys: reminders stay dry-run");
  }
  if ((src.VERCEL || src.VERCEL_ENV) && (src.TSAAD_E2E || src.TSAAD_TEST_NOW || src.TSAAD_TEST_CLOCK_KEY)) {
    warnings.push("test clock variables are set on Vercel; they are ignored there, remove them");
  }
  return warnings;
}
