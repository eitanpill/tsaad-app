import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { SESSION_POLICY } from "./config";
import { newToken, sha256Hex } from "./crypto";
import { rowsOf } from "./sql";

export type SessionUser = { sessionId: string; userId: string; username: string; displayName: string };

/**
 * יוצר התחברות חדשה (אסימון אטום; רק ה־hash נשמר). הפקודה הזאת תמיד יוצרת אסימון חדש,
 * וההפעלה הקודמת (אם יש) נמחקת בנפרד דרך rotateSession.
 */
export async function createSession(
  db: Pick<Db, "execute">,
  userId: string,
  policy: typeof SESSION_POLICY = SESSION_POLICY,
): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const res = await db.execute(
    sql`insert into sessions (user_id, token_hash, expires_at)
        values (${userId}, ${sha256Hex(token)}, now() + make_interval(days => ${policy.absoluteDays}))
        returning expires_at`,
  );
  const expiresAt = rowsOf<{ expires_at: Date | string }>(res)[0].expires_at;
  return { token, expiresAt: new Date(expiresAt) };
}

/** סיבוב בהתחברות: מוחק את ההפעלה הקודמת של הדפדפן (אם יש) ויוצר חדשה. */
export async function rotateSession(
  db: Db,
  userId: string,
  previousToken: string | undefined,
): Promise<{ token: string; expiresAt: Date }> {
  return db.transaction(async (tx) => {
    if (previousToken) await deleteSession(tx, previousToken);
    return createSession(tx, userId);
  });
}

/**
 * בודק התחברות ומעדכן last_seen_at בפקודה אחת.
 * נדחה אם עבר התוקף המוחלט או אם עבר זמן ההיעדרות. הכתיבה מוגבלת לפעם ב־touchEverySeconds.
 */
export async function validateSession(
  db: Pick<Db, "execute">,
  token: string,
  policy: typeof SESSION_POLICY = SESSION_POLICY,
): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const res = await db.execute(
    sql`update sessions s
        set last_seen_at = case
              when s.last_seen_at < now() - make_interval(secs => ${policy.touchEverySeconds})
              then now() else s.last_seen_at end
        from users u
        where s.token_hash = ${sha256Hex(token)}
          and u.id = s.user_id
          and u.password_hash is not null
          and s.expires_at > now()
          and s.last_seen_at > now() - make_interval(days => ${policy.idleDays})
        returning s.id as "sessionId", u.id as "userId", u.username, u.display_name as "displayName"`,
  );
  return rowsOf<SessionUser>(res)[0] ?? null;
}

/** יציאה: מוחק את השורה. */
export async function deleteSession(db: Pick<Db, "execute">, token: string): Promise<void> {
  if (!token || token.length > 200) return;
  await db.execute(sql`delete from sessions where token_hash = ${sha256Hex(token)}`);
}

export async function deleteAllSessions(db: Pick<Db, "execute">, userId: string): Promise<void> {
  await db.execute(sql`delete from sessions where user_id = ${userId}`);
}

const deleted = (res: unknown) => (res as { rowCount?: number | null } | null)?.rowCount ?? 0;

/** ניקוי תקופתי (נקרא מ־api/cron/cleanup): התחברויות שפגו, קישורים ישנים וניסיונות ישנים. מחזיר ספירות. */
export async function purgeExpired(
  db: Pick<Db, "execute">,
): Promise<{ sessions: number; activationTokens: number; loginAttempts: number }> {
  const sessions = await db.execute(
    sql`delete from sessions
        where expires_at <= now() or last_seen_at <= now() - make_interval(days => ${SESSION_POLICY.idleDays})`,
  );
  const activationTokens = await db.execute(
    sql`delete from activation_tokens
        where expires_at < now() - interval '7 days' or used_at < now() - interval '7 days'`,
  );
  const loginAttempts = await db.execute(
    sql`delete from login_attempts where attempted_at < now() - interval '1 day'`,
  );
  return {
    sessions: deleted(sessions),
    activationTokens: deleted(activationTokens),
    loginAttempts: deleted(loginAttempts),
  };
}
