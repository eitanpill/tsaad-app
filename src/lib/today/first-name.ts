/**
 * השם הפרטי לברכה, רק כשיש שם נקי בחשבון. ב־users.display_name נשמר השם שעבר ניקוי בהרשמה (cleanName:
 * אותיות, ניקוד, רווח, גרש ומקף בלבד), ובלי שם בטופס נשמר שם המשתמש במקומו; שם משתמש כזה אינו שם, ולכן אין ברכה בשם.
 * מחזיר את המילה הראשונה, או null (אז הברכה "בוקר טוב" נשארת לבדה).
 */
// מתחיל באות; אחריה רק אותיות, ניקוד, גרש ומקף. אין ספרות, סימני כיוון (bidi), תווים בלתי נראים, אימוג'י, נקודה, נקודתיים או לוכסן (כתובות).
const CLEAN = /^\p{L}[\p{L}\p{M}'’׳\-־]*$/u;

export function firstNameOf(displayName: string | null | undefined, username: string): string | null {
  const name = (displayName ?? "").normalize("NFC").trim();
  if (!name || name.toLowerCase() === username.toLowerCase()) return null;
  const first = name.split(/\s+/)[0];
  if (!CLEAN.test(first) || [...first].length < 2 || [...first].length > 20) return null;
  return first;
}
