/** ללא server-only: עזרים טהורים להצגת הדפים המשפטיים (מילוי אסימונים וזיהוי פרטי קשר). */

export type ContactKey = "ACCESSIBILITY_CONTACT" | "PRIVACY_CONTACT" | "SUPPORT_CONTACT";
const CONTACT_RE = /\[(ACCESSIBILITY_CONTACT|PRIVACY_CONTACT|SUPPORT_CONTACT)\]/g;

export type Segment = { text: string } | { contact: ContactKey };

/** מפצל טקסט לקטעים רגילים ולמקומות של פרטי קשר. */
export function splitContacts(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(CONTACT_RE)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ contact: m[1] as ContactKey });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** ממלא {token} מהערכים. אסימון שאין לו ערך נשאר כלשונו (ובדיקה מוודאת שזה לא קורה בדפים). */
export function fillTokens(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (Object.hasOwn(values, k) ? String(values[k]) : m));
}

export type ParsedContact =
  | { kind: "email"; value: string; href: string }
  | { kind: "tel"; value: string; href: string }
  | { kind: "text"; value: string };

/** מזהה אימייל או טלפון לקישור; כל דבר אחר מוצג כטקסט (לא נבנה ממנו קישור). */
export function parseContact(raw: string | undefined): ParsedContact | null {
  const v = raw?.trim();
  if (!v) return null;
  if (/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v)) return { kind: "email", value: v, href: `mailto:${v}` };
  if (/^\+?[\d\s\-()]{7,}$/.test(v)) {
    const digits = v.replace(/[^\d+]/g, "");
    return { kind: "tel", value: v, href: `tel:${digits}` };
  }
  return { kind: "text", value: v };
}

const DATE = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
/** "10 בנובמבר 2026" מ־"2026-11-10". */
export function formatLegalDate(iso: string): string {
  return DATE.format(new Date(`${iso}T00:00:00Z`));
}
