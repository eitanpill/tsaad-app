import { createHmac } from "node:crypto";
import { constantTimeEqual } from "@/lib/auth/crypto";

/**
 * אימות בקשת ה־webhook של GHL.
 *
 * סוד משותף GHL_WEBHOOK_SECRET (לפחות 32 תווים; חסר או קצר = אין אימות, 503). שתי דרכים, ולפחות אחת חובה:
 *  א. כותרת סטטית  x-tsaad-webhook-secret: <הסוד>   (זו מה ש־"Custom Webhook" הפשוט של GHL יכול לשלוח).
 *  ב. חתימה  x-tsaad-timestamp: <שניות unix>  +  x-tsaad-signature: hex(HMAC-SHA256(secret, `${timestamp}.${rawBody}`))
 *     (אפשר גם עם הקידומת "sha256="). לשולח שמסוגל לחשב חתימה (שרת ביניים, Make וכו').
 * כל אישור שנשלח חייב להיות תקין (כותרת סטטית שגויה נדחית גם אם יש חתימה תקינה). אם קיימת כותרת זמן, היא חייבת
 * להיות בתוך WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS מהשעון (לשני הכיוונים), גם כשהאישור היחיד הוא הכותרת הסטטית. כותרת
 * חתימה בלי כותרת זמן (ולהפך, חתימה בלי זמן) נדחית.
 * כל ההשוואות בזמן קבוע. הסוד אף פעם לא עובר ב־query string.
 */
export const WEBHOOK_SECRET_HEADER = "x-tsaad-webhook-secret";
export const WEBHOOK_TIMESTAMP_HEADER = "x-tsaad-timestamp";
export const WEBHOOK_SIGNATURE_HEADER = "x-tsaad-signature";
export const WEBHOOK_EVENT_ID_HEADER = "x-tsaad-event-id";
/** חלון הזמן החתום: קצר מ־30 הימים ששורות webhook_events נשמרות, כך ששידור חוזר ישן לא יעבור. */
export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;
export const MIN_WEBHOOK_SECRET_LENGTH = 32;

export type AuthFailure = "no_credentials" | "bad_secret" | "bad_timestamp" | "stale_timestamp" | "bad_signature";
export type AuthResult =
  | { ok: true; via: "secret" | "signature" }
  | { ok: false; reason: "not_configured" }
  | { ok: false; reason: AuthFailure };

type HeaderGetter = { get(name: string): string | null };

export const isWebhookSecretConfigured = (secret: string | undefined): secret is string =>
  typeof secret === "string" && secret.length >= MIN_WEBHOOK_SECRET_LENGTH;

/** HMAC על הבתים הגולמיים של הגוף כפי שהתקבלו (לא על מחרוזת מפוענחת: פענוח מחליף רצפים לא תקינים ומסיר BOM). */
export function signWebhook(secret: string, timestamp: string, rawBody: string | Uint8Array): string {
  return createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex");
}

/** שניות unix (או אלפיות שנייה, אם הערך גדול מ־1e12). null אם אינו מספר שלם חיובי. */
function parseTimestampSeconds(v: string): number | null {
  if (!/^\d{1,13}$/.test(v)) return null;
  const n = Number(v);
  return n > 1e12 ? Math.floor(n / 1000) : n;
}

export function verifyWebhookAuth(args: {
  headers: HeaderGetter;
  rawBody: string | Uint8Array;
  secret: string | undefined;
  now: Date;
}): AuthResult {
  const { headers, rawBody, secret, now } = args;
  if (!isWebhookSecretConfigured(secret)) return { ok: false, reason: "not_configured" };

  const staticHeader = headers.get(WEBHOOK_SECRET_HEADER);
  const tsHeader = headers.get(WEBHOOK_TIMESTAMP_HEADER);
  const sigHeader = headers.get(WEBHOOK_SIGNATURE_HEADER);

  // השוואות מתבצעות תמיד (גם כשהקודמות נכשלו) כדי שהזמן לא יגלה איזו בדיקה נכשלה.
  const failures: AuthFailure[] = [];
  const fail = (f: AuthFailure) => {
    failures.push(f);
  };

  const hasCredential = staticHeader !== null || sigHeader !== null;
  if (!hasCredential) fail("no_credentials");

  let staticOk = false;
  if (staticHeader !== null) {
    staticOk = constantTimeEqual(staticHeader, secret);
    if (!staticOk) fail("bad_secret");
  }

  if (tsHeader !== null) {
    const ts = parseTimestampSeconds(tsHeader.trim());
    if (ts === null) {
      fail("bad_timestamp");
    } else if (Math.abs(Math.floor(now.getTime() / 1000) - ts) > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
      fail("stale_timestamp");
    }
  }

  let sigOk = false;
  if (sigHeader !== null) {
    if (tsHeader === null) {
      fail("bad_timestamp");
    } else {
      const given = sigHeader.trim().replace(/^sha256=/i, "").toLowerCase();
      sigOk = constantTimeEqual(given, signWebhook(secret, tsHeader.trim(), rawBody));
      if (!sigOk) fail("bad_signature");
    }
  }

  if (failures.length > 0) return { ok: false, reason: failures[0] };
  return { ok: true, via: staticOk ? "secret" : "signature" };
}
