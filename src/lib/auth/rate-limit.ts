import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { hmacHex } from "./crypto";
import { RATE_LIMITS } from "./config";
import { rowsOf } from "./sql";

export type AttemptKind = "login" | "forgot" | "toggle";

export type RateLimitKeys = { identifierHash: string; ipHash: string | null };

/** מזהה ו־IP נשמרים רק כ־HMAC במפתח הסוד, לא כ־sha256 פשוט (שאפשר לנחש לו מילון). */
export function rateLimitKeys(
  secret: string,
  identifier: string,
  ip: string | null | undefined,
): RateLimitKeys {
  return {
    identifierHash: hmacHex(secret, "rl-id", identifier.trim().toLowerCase()),
    ipHash: ip ? hmacHex(secret, "rl-ip", ip.trim()) : null,
  };
}

export type LimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

type Limits = { windowSeconds: number; perIdentifier: number; perIp: number };

/**
 * רושם ניסיון ובודק אם עבר את המגבלה (לפי מזהה ולפי IP), בלי "בדוק ואז רשום":
 * קודם נרשם הניסיון ואז נספרים הניסיונות בחלון, כך שבקשות מקבילות לא עוקפות את המגבלה.
 * ניסיון שנחסם נמחק מיד, כדי שחסימה לא תתארך ככל שממשיכים לנסות.
 * חלון הזמן מחושב בשעון המסד.
 */
export async function registerAttempt(
  db: Pick<Db, "execute">,
  kind: AttemptKind,
  keys: RateLimitKeys,
  limits: Limits = RATE_LIMITS[kind],
): Promise<LimitResult> {
  const inserted = await db.execute(
    sql`insert into login_attempts (kind, identifier_hash, ip_hash)
        values (${kind}, ${keys.identifierHash}, ${keys.ipHash})
        returning id`,
  );
  const id = rowsOf<{ id: string }>(inserted)[0].id;

  const counts = await db.execute(
    sql`select
          (select count(*)::int from login_attempts
            where kind = ${kind} and identifier_hash = ${keys.identifierHash}
              and attempted_at > now() - make_interval(secs => ${limits.windowSeconds})) as by_id,
          (select count(*)::int from login_attempts
            where kind = ${kind} and ${keys.ipHash}::text is not null and ip_hash = ${keys.ipHash}
              and attempted_at > now() - make_interval(secs => ${limits.windowSeconds})) as by_ip,
          (select coalesce(extract(epoch from (min(attempted_at) + make_interval(secs => ${limits.windowSeconds}) - now())), 0)::int
             from login_attempts
            where kind = ${kind} and identifier_hash = ${keys.identifierHash}
              and attempted_at > now() - make_interval(secs => ${limits.windowSeconds})) as retry_id`,
  );
  const row = rowsOf<{ by_id: number; by_ip: number; retry_id: number }>(counts)[0];
  if (row.by_id > limits.perIdentifier || row.by_ip > limits.perIp) {
    await db.execute(sql`delete from login_attempts where id = ${id}`);
    return { allowed: false, retryAfterSeconds: Math.max(1, row.retry_id || limits.windowSeconds) };
  }
  return { allowed: true };
}

/** אחרי התחברות מוצלחת: מנקים את הניסיונות הכושלים של אותו מזהה. */
export async function clearAttempts(
  db: Pick<Db, "execute">,
  kind: AttemptKind,
  keys: RateLimitKeys,
): Promise<void> {
  await db.execute(
    sql`delete from login_attempts where kind = ${kind} and identifier_hash = ${keys.identifierHash}`,
  );
}
