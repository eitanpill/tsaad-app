import { normalizeEmail, normalizePhoneIL } from "@/lib/webhooks/ghl/normalize";

/**
 * מזהה כניסה: שם משתמש, טלפון או מייל. אותו נרמול כמו בהרשמה (webhook):
 * מייל באותיות קטנות; טלפון (05x, +9725x, 9725x ועוד) ל־E.164; אחרת שם משתמש באותיות קטנות.
 * "normalized" הוא המפתח להגבלת הקצב, כך שכל כתיב של אותו טלפון נספר כאחד.
 */
export type LoginIdentifier =
  | { kind: "email"; normalized: string }
  | { kind: "phone"; normalized: string; raw: string }
  | { kind: "username"; normalized: string };

const PHONE_SHAPE = /^[+\d\s().-]+$/;

export function classifyIdentifier(input: string): LoginIdentifier {
  const raw = input.trim();
  const lower = raw.toLowerCase();
  if (lower.includes("@")) {
    const email = normalizeEmail(lower);
    // כתובת לא תקינה נשארת "שם משתמש" (לא יתאים לאף חשבון, כי שמות משתמש הם [a-z0-9._-]).
    return email ? { kind: "email", normalized: email } : { kind: "username", normalized: lower };
  }
  if (PHONE_SHAPE.test(raw)) {
    const phone = normalizePhoneIL(raw);
    if (phone) return { kind: "phone", normalized: phone, raw: lower };
  }
  return { kind: "username", normalized: lower };
}
