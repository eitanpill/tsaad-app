/**
 * נרמול קלט מ־GHL: אימייל וטלפון (ישראלי, ל־E.164). פונקציות טהורות; ערך לא תקין מחזיר null
 * (ההרשמה לא נופלת בגלל שדה אחד פגום כל עוד השני תקין; ראו payload.ts).
 */

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** אותיות קטנות, בלי רווחים בקצוות; null אם הצורה אינה כתובת סבירה (או ארוכה מ־254 תווים). */
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const e = input.trim().toLowerCase();
  if (e.length === 0 || e.length > 254) return null;
  return EMAIL_RE.test(e) ? e : null;
}

/** מספר ישראלי לאחר הסרת קידומת: נייד 5X (9 ספרות), VoIP 7X (9 ספרות), קווי 2/3/4/8/9 (8 ספרות). */
const IL_NATIONAL = /^(?:5\d{8}|7\d{8}|[23489]\d{7})$/;

/**
 * טלפון ל־E.164. מקבל: 0521234567, 052-123-4567, (052) 123 4567, 972521234567, +972521234567,
 * 00972521234567, +972 (0)52-123-4567, 521234567 (בלי 0 מוביל). מספר בינלאומי אחר עם "+" (או 00)
 * נשמר כפי שהוא אם הוא נראה כמו E.164 (8 עד 15 ספרות, לא מתחיל באפס).
 */
export function normalizePhoneIL(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (raw.length === 0 || raw.length > 40) return null;
  // רק ספרות, רווחים ותווי פיסוק נפוצים. אותיות (למשל "ext") הופכות את הערך ללא תקין.
  if (!/^[+\d\s().-]+$/.test(raw)) return null;
  const hadPlus = raw.startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (!hadPlus && digits.startsWith("0")) {
    // לאומי: 0 מוביל ואחריו המספר.
    const national = digits.slice(1);
    return IL_NATIONAL.test(national) ? `+972${national}` : null;
  }
  if (digits.startsWith("972")) {
    // גם "+972 (0)52…": אפס מיותר אחרי הקידומת.
    const national = digits.slice(3).replace(/^0/, "");
    return IL_NATIONAL.test(national) ? `+972${national}` : null;
  }
  if (!hadPlus && !raw.startsWith("00") && IL_NATIONAL.test(digits)) return `+972${digits}`;
  if ((hadPlus || raw.startsWith("00")) && /^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  return null;
}

/**
 * שם לתצוגה. השם מגיע מטופס ציבורי ונכנס להודעות שנשלחות בשם התוכנית, ולכן רשימת היתר ולא רשימת איסור:
 * אותיות (כל כתב), סימני ניקוד, רווח, גרש/גרשיים ומקף (כולל מקף עברי). כל השאר הופך לרווח: ספרות (מספרי טלפון),
 * נקודות, נקודתיים ולוכסנים (כתובות כמו "evil.com" או "https://..."), סוגריים (<>{}[], ומציינים כמו "[START_DATE]"),
 * תווי בקרה, תווי כיווניות (LRM/RLM, LRE..RLO, LRI..PDI, ALM), תווים ברוחב אפס ו־emoji. נרמול NFC, רווחים מכווצים,
 * עד 80 תווים. null אם לא נשאר כלום.
 */
const NAME_DISALLOWED = /[^\p{L}\p{M} '\u2019\u05F3\u05F4"\-\u05BE]/gu;

export function cleanName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input
    .normalize("NFC")
    .replace(NAME_DISALLOWED, " ")
    // סימנים "בלתי נראים" מקטגוריית M: בוררי וריאציה (emoji), CGJ, בוררי מונגולית.
    .replace(/[\u034F\u180B-\u180D\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu, " ")
    // סימן ניקוד רק אחרי אות.
    .replace(/(?<![\p{L}\p{M}])\p{M}+/gu, " ")
    // "Zalgo": לא יותר משלושה סימני ניקוד רצופים (מספיק לניקוד עברי מלא).
    .replace(/(\p{M}{3})\p{M}+/gu, "$1")
    .replace(/\s+/g, " ")
    .replace(/^[\s'\u2019\u05F3\u05F4"\-\u05BE]+|[\s\-\u05BE]+$/g, "")
    .trim();
  if (!/\p{L}/u.test(s)) return null;
  return [...s].slice(0, 80).join("").trim();
}
