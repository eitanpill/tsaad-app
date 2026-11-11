import "server-only";
import { hmacHex, constantTimeEqual } from "@/lib/auth/crypto";
import { CHALLENGE } from "@/config/constants";

/**
 * עוגיית "תצוגה מקדימה של יום" לבעלים. הערך: `v1.<יום>.<פקיעה בשניות>.<חתימה>`. החתימה היא HMAC במפתח SESSION_SECRET
 * על (מזהה המשתמש, יום, פקיעה), כלומר העוגייה קשורה לחשבון שיצר אותה: זיוף, עוגייה של חשבון אחר או עוגייה שפגה נדחים.
 * הבדיקה הזאת לבדה אינה הרשאה: בכל בקשה בודקים גם שהמשתמש מנהל (ADMIN_USERNAMES), ראו context.ts.
 */
export const PREVIEW_TTL_SECONDS = 12 * 60 * 60;
const VERSION = "v1";

const sig = (secret: string, userId: string, day: number, exp: number) => hmacHex(secret, "preview", `${userId}\u0000${day}\u0000${exp}`);

export function isPreviewDay(day: unknown): day is number {
  return typeof day === "number" && Number.isInteger(day) && day >= 1 && day <= CHALLENGE.totalDays;
}

export function signPreviewCookie(secret: string, userId: string, day: number, nowMs: number): { value: string; maxAge: number } {
  if (!isPreviewDay(day)) throw new RangeError("preview day out of range");
  const exp = Math.floor(nowMs / 1000) + PREVIEW_TTL_SECONDS;
  return { value: `${VERSION}.${day}.${exp}.${sig(secret, userId, day, exp)}`, maxAge: PREVIEW_TTL_SECONDS };
}

/** היום מהעוגייה, או null אם היא לא תקינה, לא חתומה על ידי המשתמש הזה, או פגה. */
export function verifyPreviewCookie(secret: string, userId: string, value: string | undefined, nowMs: number): number | null {
  if (!value || value.length > 200) return null;
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  if (!/^\d{1,2}$/.test(parts[1]) || !/^\d{1,12}$/.test(parts[2])) return null;
  const day = Number(parts[1]);
  const exp = Number(parts[2]);
  if (!isPreviewDay(day) || exp * 1000 <= nowMs) return null;
  return constantTimeEqual(parts[3], sig(secret, userId, day, exp)) ? day : null;
}
