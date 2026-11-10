import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { RATE_LIMITS } from "@/lib/auth/config";
import { verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import { PASSWORD_POLICY } from "@/lib/auth/policy";
import { clearAttempts, rateLimitKeys, registerAttempt } from "@/lib/auth/rate-limit";
import { rowsOf } from "@/lib/auth/sql";

export type DeleteAccountResult =
  | { ok: true; ghlContactId: string | null }
  | { ok: false; reason: "invalid_password" | "rate_limited" | "not_found"; retryAfterSeconds?: number };

/**
 * מחיקת חשבון עצמית. החשבון הוא של המשתמש המחובר בלבד (userId מהסשן, לא מהטופס).
 * 1. ניסיון נרשם לפני האימות (מגבלה לפי משתמש ולפי IP); סיסמה שגויה נספרת, הצלחה מנקה.
 * 2. האימות הוא סיסמה, אותה בדיקה כמו בכניסה (argon2id).
 * 3. מחיקת שורת users; כל הטבלאות עם מידע אישי מצביעות אליה ב־ON DELETE CASCADE (סשנים, קישורי הפעלה, ניסיונות,
 *    סימונים, מנויי התראות, יומן תזכורות, outbox הסנכרון). שום דבר לא נשלח ל־GHL: ראו docs/LEGAL_REVIEW.md.
 * מחזיר את מזהה איש הקשר ב־GHL (אם היה) רק כדי שהקורא יוכל לרשום "הודעת מחיקה" (dry-run) בלי מידע אישי.
 */
export async function deleteAccountCore(
  db: Db,
  args: { userId: string; password: string; secret: string; ip?: string | null },
): Promise<DeleteAccountResult> {
  const keys = rateLimitKeys(args.secret, `account:${args.userId}`, args.ip);
  const limit = await registerAttempt(db, "account", keys, RATE_LIMITS.account);
  if (!limit.allowed) return { ok: false, reason: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds };

  const res = await db.execute(sql`select password_hash from users where id = ${args.userId}`);
  const user = rowsOf<{ password_hash: string | null }>(res)[0];
  const tooLong = [...args.password].length > PASSWORD_POLICY.maxLength;
  const ok =
    user?.password_hash && !tooLong && args.password
      ? await verifyPassword(user.password_hash, args.password)
      : await verifyAgainstDummy(args.password);
  if (!user) return { ok: false, reason: "not_found" };
  if (!ok) return { ok: false, reason: "invalid_password" };

  const deleted = await db.execute(sql`delete from users where id = ${args.userId} returning ghl_contact_id`);
  const row = rowsOf<{ ghl_contact_id: string | null }>(deleted)[0];
  if (!row) return { ok: false, reason: "not_found" };
  // הניסיונות של המשתמש נמחקו יחד איתו (login_attempts.user_id), אבל השורה שנרשמה בלי user_id נשארת עד הניקוי היומי.
  await clearAttempts(db, "account", keys);
  return { ok: true, ghlContactId: row.ghl_contact_id };
}
