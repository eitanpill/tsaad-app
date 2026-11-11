import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { logger, type Logger } from "@/lib/logger";
import { RATE_LIMITS } from "./config";
import { hmacHex } from "./crypto";
import { classifyIdentifier } from "./identifier";
import { PASSWORD_POLICY } from "./policy";
import { verifyAgainstDummy, verifyPassword } from "./password";
import { clearAttempts, rateLimitKeys, registerAttempt, type RateLimitKeys } from "./rate-limit";
import { rowsOf } from "./sql";

/** מגבלת החשבון: אותה מכסה כמו למזהה, בלי מגבלת IP (ה־IP כבר נספר במפתח המזהה). */
const USER_LIMIT = { windowSeconds: RATE_LIMITS.login.windowSeconds, perIdentifier: RATE_LIMITS.login.perIdentifier, perIp: Number.POSITIVE_INFINITY };

export type LoginResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "rate_limited"; retryAfterSeconds?: number };

export const USERNAME_MAX_LENGTH = 254;

type Candidate = { id: string; password_hash: string | null };

/**
 * אימות שם משתמש, טלפון או מייל, וסיסמה. כל הכשלים (לא קיים, לא מופעל, סיסמה שגויה, קלט לא תקין,
 * וגם מייל או טלפון ששייכים ליותר מחשבון אחד) מחזירים את אותה תשובה "invalid", ועולים אותו זמן:
 * אותן שאילתות ובדיקת hash אחת (דמה כשאין חשבון יחיד).
 * הגבלת הקצב נרשמת לפני האימות, פעמיים: לפי המזהה המנורמל (כל כתיב של אותו טלפון נספר יחד), ולפי החשבון
 * שנמצא (כדי שמייל, טלפון ושם משתמש של אותו חשבון לא יכפילו את המכסה). כשאין חשבון, המפתח השני
 * נגזר מהמזהה, כך שהעבודה זהה. הכל מתנקה בהצלחה.
 * כתובת או טלפון משותפים לכמה חשבונות: לא מתחברים בעזרתם (נרשם ביומן, בלי הערך); נכנסים עם שם המשתמש.
 */
export async function authenticate(
  db: Db,
  args: { identifier: string; password: string; secret: string; ip?: string | null; log?: Logger },
): Promise<LoginResult> {
  const log = args.log ?? logger;
  const id = classifyIdentifier(args.identifier);
  const keys = rateLimitKeys(args.secret, id.normalized, args.ip);

  const limit = await registerAttempt(db, "login", keys);
  if (!limit.allowed) {
    return { ok: false, reason: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds };
  }

  const tooLong =
    args.identifier.trim().length > USERNAME_MAX_LENGTH || [...args.password].length > PASSWORD_POLICY.maxLength;
  let candidates: Candidate[] = [];
  if (!tooLong && id.normalized) {
    const byEmail = id.kind === "email" ? sql` or lower(email) = ${id.normalized}` : sql``;
    const byPhone = id.kind === "phone" ? sql` or phone = ${id.normalized}` : sql``;
    // שם משתמש מורכב מספרות (למשל 0521234567) נתפס גם כטלפון: מחפשים לפי שניהם.
    const nameKey = id.kind === "phone" ? id.raw : id.normalized;
    const res = await db.execute(
      sql`select id, password_hash from users where username = ${nameKey}${byEmail}${byPhone} limit 3`,
    );
    candidates = rowsOf<Candidate>(res);
  }
  const user = candidates.length === 1 ? candidates[0] : undefined;
  if (candidates.length > 1) {
    log.warn("login: identifier matches more than one account; refused", { kind: id.kind, matches: candidates.length });
  }

  const userKeys: RateLimitKeys = {
    identifierHash: hmacHex(args.secret, "rl-user", user ? user.id : `none:${id.normalized}`),
    ipHash: null,
  };
  const userLimit = await registerAttempt(db, "login", userKeys, USER_LIMIT);
  if (!userLimit.allowed) {
    return { ok: false, reason: "rate_limited", retryAfterSeconds: userLimit.retryAfterSeconds };
  }

  const ok =
    !tooLong && user?.password_hash
      ? await verifyPassword(user.password_hash, args.password)
      : await verifyAgainstDummy(args.password);

  if (!ok || !user) return { ok: false, reason: "invalid" };
  await clearAttempts(db, "login", keys);
  await clearAttempts(db, "login", userKeys);
  return { ok: true, userId: user.id };
}

/**
 * אחרי שקישור חד־פעמי הוכיח בעלות: מנקה את מנעולי הכניסה של החשבון, לפי שם המשתמש, המייל והטלפון
 * שלו ולפי החשבון עצמו, כדי שהכניסה הבאה עם הסיסמה החדשה תעבוד בכל אחת מהדרכים.
 */
export async function clearLoginLimitsForUser(db: Db, userId: string, secret: string): Promise<void> {
  const row = rowsOf<{ username: string; email: string | null; phone: string | null }>(
    await db.execute(sql`select username, email, phone from users where id = ${userId}`),
  )[0];
  if (!row) return;
  const identifiers = [row.username, row.email, row.phone].filter((v): v is string => !!v);
  for (const raw of identifiers) {
    await clearAttempts(db, "login", rateLimitKeys(secret, classifyIdentifier(raw).normalized, null));
  }
  await clearAttempts(db, "login", { identifierHash: hmacHex(secret, "rl-user", userId), ipHash: null });
}
