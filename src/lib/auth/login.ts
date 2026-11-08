import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { PASSWORD_POLICY } from "./policy";
import { verifyAgainstDummy, verifyPassword } from "./password";
import { clearAttempts, rateLimitKeys, registerAttempt } from "./rate-limit";
import { rowsOf } from "./sql";

export type LoginResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "rate_limited"; retryAfterSeconds?: number };

export const USERNAME_MAX_LENGTH = 254;

/**
 * אימות שם משתמש וסיסמה. כל הכשלים (משתמש לא קיים, לא מופעל, סיסמה שגויה, קלט לא תקין)
 * מחזירים את אותה תשובה "invalid", ועולים אותו זמן (hash דמה).
 * כל ניסיון נרשם לפני האימות (מגבלה לפי מזהה ולפי IP) ומתנקה בהצלחה.
 */
export async function authenticate(
  db: Db,
  args: { username: string; password: string; secret: string; ip?: string | null },
): Promise<LoginResult> {
  const username = args.username.trim().toLowerCase();
  const keys = rateLimitKeys(args.secret, username, args.ip);

  const limit = await registerAttempt(db, "login", keys);
  if (!limit.allowed) {
    return { ok: false, reason: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds };
  }

  const tooLong =
    username.length > USERNAME_MAX_LENGTH || [...args.password].length > PASSWORD_POLICY.maxLength;
  let user: { id: string; password_hash: string | null } | undefined;
  if (!tooLong && username) {
    const res = await db.execute(
      sql`select id, password_hash from users where username = ${username}`,
    );
    user = rowsOf<{ id: string; password_hash: string | null }>(res)[0];
  }

  const ok =
    !tooLong && user?.password_hash
      ? await verifyPassword(user.password_hash, args.password)
      : await verifyAgainstDummy(args.password);

  if (!ok || !user) return { ok: false, reason: "invalid" };
  await clearAttempts(db, "login", keys);
  return { ok: true, userId: user.id };
}
