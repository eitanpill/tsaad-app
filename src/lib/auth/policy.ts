/**
 * מדיניות הסיסמה. בלי "server-only", כדי שגם הטופס בצד הלקוח יציג את אותן דרישות.
 */
export type PasswordPolicy = { minLength: number; requireDigit: boolean; maxLength: number };

export const PASSWORD_POLICY: Readonly<PasswordPolicy> = Object.freeze({
  /** הצעת עיצוב: לפחות 8 תווים וספרה אחת (תואם ל־copy.activate). */
  minLength: 8,
  requireDigit: true,
  /** מגבלה עליונה, כדי שלא יהיה אפשר לאלץ חישוב hash על קלט עצום. */
  maxLength: 128,
});


export type PasswordIssue = "required" | "tooShort" | "noDigit" | "tooLong" | "sameAsUsername";

/**
 * בדיקת מדיניות הסיסמה. הסדר קובע איזו שגיאה מוצגת ראשונה.
 * אין דרישת "סימן מיוחד" או אותיות גדולות (NIST 800-63B).
 */
export function validatePassword(
  password: string,
  opts: { username?: string } = {},
  policy: Readonly<PasswordPolicy> = PASSWORD_POLICY,
): PasswordIssue | null {
  if (!password) return "required";
  if ([...password].length > policy.maxLength) return "tooLong";
  if ([...password].length < policy.minLength) return "tooShort";
  if (policy.requireDigit && !/\d/.test(password)) return "noDigit";
  if (opts.username && password.trim().toLowerCase() === opts.username.trim().toLowerCase()) {
    return "sameAsUsername";
  }
  return null;
}

/** דרישות להצגה חיה ברשימה בטופס (בלי שגיאות חסימה). */
export function passwordRequirements(password: string, policy: Readonly<PasswordPolicy> = PASSWORD_POLICY) {
  return {
    minLength: [...password].length >= policy.minLength,
    digit: !policy.requireDigit || /\d/.test(password),
  };
}
