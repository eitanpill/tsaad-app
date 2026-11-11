import type { Env } from "@/config/env";

export type GhlMode = "off" | "dry" | "live";

export type GhlConfig = {
  reminderMode: GhlMode;
  deliveryMode: GhlMode;
  token: string | undefined;
  locationId: string | undefined;
  fields: { todayUrl: string; activationUrl: string };
  tags: { reminderPrefix: string; accountReady: string; resetReady: string };
  /** סיבה לכך ש־live הורד ל־off (חסר טוקן או מיקום, או סביבת בדיקות); null אם אין. */
  liveRefused: string | null;
};

type EnvLike = Pick<
  Env,
  | "GHL_REMINDER_MODE" | "GHL_DELIVERY_MODE" | "GHL_API_TOKEN" | "GHL_LOCATION_ID"
  | "GHL_FIELD_TODAY_URL" | "GHL_FIELD_ACTIVATION_URL"
  | "GHL_TAG_REMINDER_PREFIX" | "GHL_TAG_ACCOUNT_READY" | "GHL_TAG_RESET_READY"
>;

/** סביבת בדיקות או e2e: live אף פעם לא מופעל שם, גם אם הוגדר. */
const isTestEnv = (raw: Record<string, string | undefined>) =>
  raw.TSAAD_E2E === "1" || !!raw.TSAAD_TEST_NOW || raw.NODE_ENV === "test";

/**
 * תצורת GHL. live בלי טוקן או מיקום, או בסביבת בדיקות, הופך ל־off (נכשל סגור) ומוסבר ב־liveRefused.
 * `raw` הוא מקור הסביבה הגולמי (לבדיקת סביבת הבדיקות בלבד).
 */
export function getGhlConfig(env: EnvLike, raw: Record<string, string | undefined> = {}): GhlConfig {
  const wantsLive = env.GHL_REMINDER_MODE === "live" || env.GHL_DELIVERY_MODE === "live";
  let liveRefused: string | null = null;
  if (wantsLive) {
    if (isTestEnv(raw)) liveRefused = "live mode is never enabled in test environments";
    else if (!env.GHL_API_TOKEN || !env.GHL_LOCATION_ID) liveRefused = "live mode needs GHL_API_TOKEN and GHL_LOCATION_ID";
  }
  const eff = (m: GhlMode): GhlMode => (m === "live" && liveRefused ? "off" : m);
  return {
    reminderMode: eff(env.GHL_REMINDER_MODE),
    deliveryMode: eff(env.GHL_DELIVERY_MODE),
    token: env.GHL_API_TOKEN,
    locationId: env.GHL_LOCATION_ID,
    fields: { todayUrl: env.GHL_FIELD_TODAY_URL, activationUrl: env.GHL_FIELD_ACTIVATION_URL },
    tags: {
      reminderPrefix: env.GHL_TAG_REMINDER_PREFIX,
      accountReady: env.GHL_TAG_ACCOUNT_READY,
      resetReady: env.GHL_TAG_RESET_READY,
    },
    liveRefused,
  };
}
