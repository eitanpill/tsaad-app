import "server-only";
import { createHash } from "node:crypto";
import { readEnv } from "@/config";
import { WEBHOOK } from "@/config/constants";
import type { Db } from "@/db";
import { RATE_LIMITS, getActivationTtlMinutes, getAppOrigin, getSessionSecret } from "@/lib/auth/config";
import { isBlocked, rateLimitKeys, registerAttempt } from "@/lib/auth/rate-limit";
import { clientIp } from "@/lib/auth/request";
import { makeSchedule, registrationClosed } from "@/lib/days";
import type { Logger } from "@/lib/logger";
import {
  WEBHOOK_EVENT_ID_HEADER,
  isWebhookSecretConfigured,
  verifyWebhookAuth,
} from "./auth";
import { composeSignupMessages, type SignupDelivery } from "./delivery";
import { EVENT_ID_RE, parseSignupPayload } from "./payload";
import { processSignup, type IssuedLink } from "./signup";

const HEADERS = { "Cache-Control": "no-store" };
const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...HEADERS, ...extra } });
const fail = (error: string, status: number, extra?: Record<string, string>) =>
  json({ ok: false, error }, status, extra);

export type HandlerDeps = {
  db: () => Db;
  log: Logger;
  delivery: SignupDelivery;
  /** next/server `after` (או בדיקה). */
  after: (task: () => Promise<void>) => void;
  now?: () => Date;
  env?: Record<string, string | undefined>;
  startDate?: () => string | undefined;
};

/** קורא את הגוף (בתים גולמיים) ועוצר ברגע שעבר את התקרה (גם בלי Content-Length). null = גדול מדי. */
async function readCapped(req: Request, max: number): Promise<Uint8Array | null> {
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * מזהה האירוע: כותרת x-tsaad-event-id, אחרת נגזר דטרמיניסטית מאיש הקשר וסמן ההרשמה (אם נשלח).
 * גם מזהה מהכותרת נקשר לאיש הקשר (hash של שניהם): הגדרה שגויה ב־GHL, למשל ערך קבוע כמו {{workflow.id}},
 * לא תהפוך את כל ההרשמות שאחרי הראשונה ל־"duplicate" שקט; לכל היותר תתנהג כמו הגזירה לפי איש קשר.
 */
export function deriveEventId(headerValue: string | null, contactId: string, marker: string | null): string | null {
  if (headerValue !== null) {
    const v = headerValue.trim();
    if (!EVENT_ID_RE.test(v)) return null;
    return `ghl:evt:${createHash("sha256").update(`${contactId}\u0000${v}`).digest("hex").slice(0, 40)}`;
  }
  const h = createHash("sha256").update(`${contactId}\u0000${marker ?? ""}`).digest("hex").slice(0, 40);
  return `ghl:signup:${h}`;
}

/**
 * POST /api/webhooks/ghl/signup. סדר: סוד מוגדר (503) > חסימת IP אחרי כשלים (429) > גודל (413) > אימות (401) >
 * סוג תוכן (415) > JSON וסכמה (400) > הגדרות (503) > עיבוד בטרנזקציה > תשובה, והמשלוח ב־after.
 * התשובה היא {ok, status} בלבד: בלי אסימון ובלי פרטים אישיים.
 */
export async function handleGhlSignup(req: Request, deps: HandlerDeps): Promise<Response> {
  const env = deps.env ?? readEnv();
  const now = deps.now ?? (() => new Date());
  const log = deps.log;

  const secret = env.GHL_WEBHOOK_SECRET;
  if (!isWebhookSecretConfigured(secret)) {
    log.error("ghl webhook: GHL_WEBHOOK_SECRET missing or shorter than 32 characters; refusing requests");
    return fail("unavailable", 503);
  }

  // IP אמין בלבד (ראו clientIp). בלי IP אין הגבלה לפי IP; הסוד הארוך הוא ההגנה.
  const ip = clientIp(req.headers, env);
  let ipKeys: ReturnType<typeof rateLimitKeys> | null = null;
  if (ip) {
    try {
      ipKeys = rateLimitKeys(getSessionSecret(env), `webhook-ip:${ip}`, ip);
      if (await isBlocked(deps.db(), "webhook", ipKeys)) {
        return fail("rate_limited", 429, { "Retry-After": String(RATE_LIMITS.webhook.windowSeconds) });
      }
    } catch (e) {
      log.error("ghl webhook: rate limit check failed", { error: e });
      return fail("unavailable", 503);
    }
  }

  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > WEBHOOK.maxBodyBytes) return fail("too_large", 413);
  const rawBody = await readCapped(req, WEBHOOK.maxBodyBytes);
  if (rawBody === null) return fail("too_large", 413);

  const auth = verifyWebhookAuth({ headers: req.headers, rawBody, secret, now: now() });
  if (!auth.ok) {
    log.warn("ghl webhook: unauthorized", { reason: auth.reason });
    if (ipKeys) {
      try {
        const r = await registerAttempt(deps.db(), "webhook", ipKeys, RATE_LIMITS.webhook);
        if (!r.allowed) return fail("rate_limited", 429, { "Retry-After": String(r.retryAfterSeconds) });
      } catch (e) {
        log.error("ghl webhook: failed to record auth failure", { error: e });
      }
    }
    return fail("unauthorized", 401);
  }

  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return fail("unsupported_media_type", 415);
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
  } catch {
    return fail("invalid", 400);
  }
  const parsed = parseSignupPayload(body);
  if (!parsed.ok) {
    log.warn("ghl webhook: invalid payload", { reason: parsed.reason });
    return fail("invalid", 400);
  }
  const eventId = deriveEventId(req.headers.get(WEBHOOK_EVENT_ID_HEADER), parsed.data.ghlContactId, parsed.data.marker);
  if (eventId === null) return fail("invalid", 400);

  let ttlMinutes: number;
  let origin: string | undefined;
  let rateLimitSecret: string;
  try {
    ttlMinutes = getActivationTtlMinutes(env);
    origin = getAppOrigin(env);
    rateLimitSecret = getSessionSecret(env);
  } catch (e) {
    log.error("ghl webhook: server configuration incomplete", { error: e });
    return fail("unavailable", 503);
  }
  if (!origin) {
    log.error("ghl webhook: APP_ORIGIN is not set; cannot build activation links");
    return fail("unavailable", 503);
  }

  let outcome;
  try {
    outcome = await processSignup(deps.db(), {
      eventId,
      payload: parsed.data,
      ttlMinutes,
      rateLimitSecret,
      log,
    });
  } catch (e) {
    log.error("ghl webhook: processing failed", { error: e });
    return fail("failed", 500);
  }

  log.info("ghl signup processed", { status: outcome.status, userId: outcome.issued?.userId, via: auth.via });
  // ההרשמה בדף הנחיתה נסגרת בסוף יום 2, אבל תשלום שכבר בוצע לא נחסם: החשבון נוצר, ורק נרשמת אזהרה.
  if (outcome.status === "created" && env.START_DATE) {
    try {
      const schedule = makeSchedule(env.START_DATE, {
        timeZone: env.TZ_NAME || undefined,
        unlockTime: env.UNLOCK_HOUR || undefined,
      });
      if (registrationClosed(now(), schedule)) {
        log.warn("ghl signup: registration is closed for this cohort; account created for a late payer", {
          userId: outcome.issued?.userId,
        });
      }
    } catch {
      /* START_DATE לא תקין: אין אזהרה, והחשבון כבר נוצר */
    }
  }

  if (outcome.issued) {
    const issued = outcome.issued;
    deps.after(() => deliver(deps, issued, parsed.data.ghlContactId, origin));
  }
  return json({ ok: true, status: outcome.status }, 200);
}

async function deliver(deps: HandlerDeps, issued: IssuedLink, ghlContactId: string, origin: string): Promise<void> {
  try {
    const link = `${origin}/activate?token=${issued.token}`;
    const messages = composeSignupMessages({
      name: issued.displayName,
      username: issued.username,
      link,
      userId: issued.userId,
      hasEmail: issued.hasEmail,
      hasPhone: issued.hasPhone,
      startDate: deps.startDate?.(),
    });
    await deps.delivery.deliver({
      userId: issued.userId,
      ghlContactId,
      username: issued.username,
      link,
      expiresAt: issued.expiresAt,
      messages,
    });
  } catch (e) {
    // כשל משלוח לא משנה את התשובה (כבר נשלחה). המשתתף/ת יכול/ה לבקש קישור חדש ב"שכחתי סיסמה".
    deps.log.error("ghl signup: delivery failed", { userId: issued.userId, error: e });
  }
}
