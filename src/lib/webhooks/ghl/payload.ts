import { z } from "zod";
import { cleanName, normalizeEmail, normalizePhoneIL } from "./normalize";

/**
 * גוף ה־webhook של GHL (Custom Webhook בתוך Workflow). GHL שולח את שדות איש הקשר ברמה העליונה
 * (contact_id, first_name, last_name, full_name, email, phone) ואת הנתונים שהוגדרו ב־"Custom Data" בתוך customData.
 * הסכמה סלחנית: שמות שדות חלופיים (id, contactId, firstName ...), שדות ריקים או null נחשבים כחסרים, ושדות לא ידועים
 * מתעלמים מהם. אימייל או טלפון לא תקינים נזרקים (לא מפילים את הבקשה), אבל חייב להישאר לפחות אחד תקין.
 */

const CONTACT_ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/;
export const EVENT_ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/;

/** מחרוזת, מספר או בוליאני כמחרוזת; ריק, null ו־undefined הופכים ל־undefined. */
const loose = z.preprocess((v) => {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "string") return v.trim() === "" ? undefined : v;
  return undefined;
}, z.string().max(500).optional());

const customData = z
  .object({ event_id: loose, signup_id: loose })
  .partial()
  .optional()
  .catch(undefined);

const rawSchema = z.object({
  contact_id: loose,
  contactId: loose,
  id: loose,
  first_name: loose,
  firstName: loose,
  last_name: loose,
  lastName: loose,
  full_name: loose,
  fullName: loose,
  name: loose,
  email: loose,
  phone: loose,
  event_id: loose,
  signup_id: loose,
  customData,
});

export type SignupPayload = {
  ghlContactId: string;
  displayName: string | null;
  email: string | null;
  phoneE164: string | null;
  /** סמן אירוע מהגוף (אם נשלח), לגזירת מזהה אירוע דטרמיניסטי. */
  marker: string | null;
};

export type ParseResult =
  | { ok: true; data: SignupPayload }
  | { ok: false; reason: "not_object" | "missing_contact_id" | "invalid_contact_id" | "missing_contact_details" };

export function parseSignupPayload(json: unknown): ParseResult {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return { ok: false, reason: "not_object" };
  }
  const parsed = rawSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "not_object" };
  const r = parsed.data;

  const contactId = (r.contact_id ?? r.contactId ?? r.id)?.trim();
  if (!contactId) return { ok: false, reason: "missing_contact_id" };
  if (!CONTACT_ID_RE.test(contactId)) return { ok: false, reason: "invalid_contact_id" };

  const email = normalizeEmail(r.email);
  const phoneE164 = normalizePhoneIL(r.phone);
  if (!email && !phoneE164) return { ok: false, reason: "missing_contact_details" };

  const first = cleanName(r.first_name ?? r.firstName);
  const last = cleanName(r.last_name ?? r.lastName);
  const full = cleanName(r.full_name ?? r.fullName ?? r.name);
  const displayName = full ?? (cleanName([first, last].filter(Boolean).join(" ")) || null);

  const rawMarker = r.event_id ?? r.signup_id ?? r.customData?.event_id ?? r.customData?.signup_id;
  const marker = rawMarker && EVENT_ID_RE.test(rawMarker.trim()) ? rawMarker.trim() : null;

  return { ok: true, data: { ghlContactId: contactId, displayName, email, phoneE164, marker } };
}
