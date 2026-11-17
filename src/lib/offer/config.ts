import "server-only";
import { getConfig } from "@/config";
import { offerLink, safeHttpsUrl } from "./links";
import { offerState, yesodotValidity, type OfferInputs } from "./model";
import type { Schedule } from "@/lib/days";

/** נתוני ההצעה מהתצורה: מועדים וקישורים (עם UTM). כתובות לא מוגדרות = null (כפתור לא פעיל). */
export function getOfferInputs(env = getConfig().env): OfferInputs {
  return { liveTime: env.LIVE_TIME_DAY14, windowHours: env.OFFER_WINDOW_HOURS };
}

export function getOfferLinks(env = getConfig().env) {
  return {
    // ההרשמה לאתגר: הכתובת כפי שהוגדרה (בלי תוויות מעקב של האפליקציה).
    challenge: safeHttpsUrl(env.MORNING_URL_CHALLENGE_79)?.toString() ?? null,
    session: offerLink(env.MORNING_URL_SESSION_271, env.OFFER_UTM_SESSION),
    bundle: offerLink(env.MORNING_URL_BUNDLE_139, env.OFFER_UTM_BUNDLE),
    yesodot: offerLink(env.MORNING_URL_YESODOT_1265, env.OFFER_UTM_YESODOT),
  };
}

export function getOfferModel(now: Date, schedule: Schedule | null) {
  const cfg = getConfig();
  const inputs = getOfferInputs(cfg.env);
  return {
    offer: offerState(now, schedule, inputs),
    // "יסודות היוגה" תקף באותו חלון של יום 14.
    yesodot: yesodotValidity(now, schedule, inputs),
    spots: cfg.env.SESSION_SPOTS ?? null,
    links: getOfferLinks(cfg.env),
    tz: cfg.timeZone,
  };
}
