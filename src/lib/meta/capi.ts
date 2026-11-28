import "server-only";
import { createHash } from "node:crypto";
import { readEnv } from "@/config";
import type { Logger } from "@/lib/logger";
import { metaPixelId } from "./pixel";

/**
 * Meta Conversions API (צד שרת): אירוע Purchase אחד לכל משתתף/ת חדש/ה באתגר.
 *
 * למה בשרת: התשלום קורה בדף של Morning, מחוץ לאתר, ולכן הפיקסל בדפדפן לא רואה את הרכישה. אחרי תשלום, Morning מתייגת את איש
 * הקשר ב־GHL, ו־GHL קורא ל־/api/webhooks/ghl/signup. כשנוצר שם חשבון חדש ("created"), נשלח מכאן Purchase אחד.
 *
 * פרטיות: נשלחים רק אימייל וטלפון אחרי גיבוב SHA-256 (כפי שמטא דורשת), מזהה איש הקשר מגובב, מדינה ומחיר. בלי שם, בלי IP,
 * בלי פרטי תשלום. הטוקן נשלח בגוף הבקשה (לא בכתובת) ולא נרשם ביומן.
 *
 * הפעלה (משתני סביבה ב־Vercel):
 *  - META_PIXEL_ID (כבר קיים), META_CAPI_TOKEN (טוקן גישה מ־Events Manager > Settings > Conversions API).
 *  - META_CAPI_MODE: off (ברירת מחדל, וגם לכל ערך לא מוכר) | test (נשלח עם META_CAPI_TEST_CODE, מופיע רק ב־Test events) | live.
 */

export const META_GRAPH_URL = "https://graph.facebook.com/v24.0";
const TIMEOUT_MS = 8_000;
const TOKEN_RE = /^[A-Za-z0-9_-]{20,512}$/;
const TEST_CODE_RE = /^[A-Za-z0-9]{3,32}$/;

export type CapiMode = "off" | "test" | "live";

export type CapiConfig = { pixelId: string; token: string; mode: "test" | "live"; testCode?: string };

/** ההגדרה או null (כבוי). מצב test בלי קוד בדיקה תקין = כבוי, כדי שאירועי בדיקה לא ייספרו כאמיתיים. */
export function capiConfig(env: Record<string, string | undefined> = readEnv()): CapiConfig | null {
  const mode = env.META_CAPI_MODE?.trim();
  if (mode !== "test" && mode !== "live") return null;
  const pixelId = metaPixelId(env.META_PIXEL_ID);
  const token = env.META_CAPI_TOKEN?.trim();
  if (!pixelId || !token || !TOKEN_RE.test(token)) return null;
  if (mode === "test") {
    const testCode = env.META_CAPI_TEST_CODE?.trim();
    if (!testCode || !TEST_CODE_RE.test(testCode)) return null;
    return { pixelId, token, mode, testCode };
  }
  return { pixelId, token, mode };
}

const sha256 = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");

/** אימייל: אותיות קטנות, בלי רווחים. טלפון: ספרות בלבד עם קידומת מדינה (972...), בלי +. לפי דרישות מטא. */
export function hashedUserData(u: { email: string | null; phoneE164: string | null; externalId: string }) {
  const out: Record<string, string[]> = { external_id: [sha256(u.externalId)], country: [sha256("il")] };
  const email = u.email?.trim().toLowerCase();
  if (email) out.em = [sha256(email)];
  const phone = u.phoneE164?.replace(/\D/g, "");
  if (phone) out.ph = [sha256(phone)];
  return out;
}

export type PurchaseEvent = {
  /** מזהה אירוע יציב (מזהה ההרשמה): ניסיון חוזר עם אותו מזהה לא ייספר פעמיים אצל מטא. */
  eventId: string;
  email: string | null;
  phoneE164: string | null;
  ghlContactId: string;
  value: number;
  currency: "ILS";
  eventTime: Date;
  /** כתובת דף המכירה (event_source_url). */
  sourceUrl?: string;
};

export function buildPurchaseBody(cfg: CapiConfig, ev: PurchaseEvent) {
  const event: Record<string, unknown> = {
    event_name: "Purchase",
    event_time: Math.floor(ev.eventTime.getTime() / 1000),
    event_id: ev.eventId,
    // התשלום קורה בדף חיצוני, ואין לנו את פרטי הדפדפן של הקונה (חובה באירוע "website"). לכן: אירוע מהמערכת (CRM).
    action_source: "system_generated",
    user_data: hashedUserData({ email: ev.email, phoneE164: ev.phoneE164, externalId: `ghl:${ev.ghlContactId}` }),
    custom_data: { value: ev.value, currency: ev.currency, content_name: "tsaad-challenge", content_type: "product" },
  };
  if (ev.sourceUrl) event.event_source_url = ev.sourceUrl;
  const body: Record<string, unknown> = { data: [event], access_token: cfg.token };
  if (cfg.mode === "test" && cfg.testCode) body.test_event_code = cfg.testCode;
  return body;
}

/** בבדיקות וב־e2e אין קריאה אמיתית למטא: רק fetchImpl מוזרק. */
const inTestEnv = (env: Record<string, string | undefined>) =>
  env.NODE_ENV === "test" || env.TSAAD_E2E === "1" || !!env.TSAAD_TEST_NOW || !!env.VITEST;

/** מתשובת שגיאה של מטא: רק הקודים המספריים (למשל 190 = טוקן לא תקין), בלי הטקסט. */
async function metaErrorCodes(res: Response): Promise<{ code?: number; subcode?: number }> {
  try {
    const json = JSON.parse((await res.text()).slice(0, 4096)) as { error?: { code?: unknown; error_subcode?: unknown } };
    const code = json?.error?.code;
    const subcode = json?.error?.error_subcode;
    return {
      ...(typeof code === "number" ? { code } : {}),
      ...(typeof subcode === "number" ? { subcode } : {}),
    };
  } catch {
    return {};
  }
}

/**
 * שולח Purchase. לא זורק אף פעם: כשל נרשם ביומן (קוד סטטוס בלבד, בלי טוקן ובלי פרטים אישיים) ולא משפיע על ההרשמה.
 * כבוי (או בסביבת בדיקה בלי fetchImpl) = לא עושה כלום.
 */
export async function sendPurchase(
  ev: PurchaseEvent,
  deps: { log: Logger; env?: Record<string, string | undefined>; fetchImpl?: typeof fetch },
): Promise<"sent" | "off" | "failed"> {
  const env = deps.env ?? readEnv();
  const cfg = capiConfig(env);
  if (!cfg) return "off";
  if (!deps.fetchImpl && inTestEnv(env)) return "off";
  const doFetch = deps.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`${META_GRAPH_URL}/${cfg.pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(buildPurchaseBody(cfg, ev)),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) {
      await res.body?.cancel().catch(() => undefined);
      deps.log.info("meta capi: purchase sent", { mode: cfg.mode });
      return "sent";
    }
    deps.log.error("meta capi: purchase rejected", { status: res.status, mode: cfg.mode, ...(await metaErrorCodes(res)) });
    return "failed";
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    deps.log.error("meta capi: purchase not sent", { reason: timedOut ? "timeout" : "network" });
    return "failed";
  }
}
