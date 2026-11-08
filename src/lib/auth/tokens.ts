import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { newToken, sha256Hex } from "./crypto";
import { rowsOf } from "./sql";

export type TokenPurpose = "activate" | "reset";

export type IssuedToken = { token: string; expiresAt: Date };

/**
 * מנפיק אסימון חד־פעמי למשתמש. רק ה־hash נשמר.
 * אסימונים קודמים שלא נוצלו, מאותה מטרה, נמחקים (רק הקישור האחרון תקף).
 * התוקף מחושב בשעון המסד (now() + ttl), כדי שבדיקת התפוגה תשתמש באותו שעון.
 */
export async function issueToken(
  db: Db,
  args: { userId: string; purpose: TokenPurpose; ttlMinutes: number },
): Promise<IssuedToken> {
  if (!Number.isInteger(args.ttlMinutes) || args.ttlMinutes <= 0) {
    throw new Error("ttlMinutes must be a positive integer");
  }
  const token = newToken();
  const tokenHash = sha256Hex(token);
  const expiresAt = await db.transaction(async (tx) => {
    // נעילת שורת המשתמש: שתי הנפקות במקביל מתבצעות בזו אחר זו.
    await tx.execute(sql`select 1 from users where id = ${args.userId} for update`);
    await tx.execute(
      sql`delete from activation_tokens
          where user_id = ${args.userId} and purpose = ${args.purpose} and used_at is null`,
    );
    const res = await tx.execute(
      sql`insert into activation_tokens (user_id, token_hash, purpose, expires_at)
          values (${args.userId}, ${tokenHash}, ${args.purpose},
                  now() + make_interval(mins => ${args.ttlMinutes}))
          returning expires_at`,
    );
    return rowsOf<{ expires_at: Date | string }>(res)[0].expires_at;
  });
  return { token, expiresAt: new Date(expiresAt) };
}

export type ConsumedToken = { tokenId: string; userId: string; purpose: TokenPurpose };

/**
 * מנצל אסימון בפקודת SQL אחת: used_at IS NULL AND expires_at > now().
 * בשתי קריאות במקביל בדיוק אחת מצליחה. אפשר להעביר tx בתוך טרנזקציה.
 */
export async function consumeToken(
  db: Pick<Db, "execute">,
  token: string,
  purposes: readonly TokenPurpose[] = ["activate", "reset"],
): Promise<ConsumedToken | null> {
  if (!token || token.length > 200) return null;
  const res = await db.execute(
    sql`update activation_tokens
        set used_at = now()
        where token_hash = ${sha256Hex(token)}
          and used_at is null
          and expires_at > now()
          and purpose = any(${purposesArray(purposes)})
        returning id as "tokenId", user_id as "userId", purpose`,
  );
  return rowsOf<ConsumedToken>(res)[0] ?? null;
}

function purposesArray(purposes: readonly TokenPurpose[]) {
  return sql`array[${sql.join(
    purposes.map((p) => sql`${p}`),
    sql`, `,
  )}]::text[]`;
}

export type PeekedToken = {
  userId: string;
  username: string;
  displayName: string;
  purpose: TokenPurpose;
};

/** בדיקה בלי ניצול (להצגת הטופס). כניסה לדף לא שורפת את הקישור. */
export async function peekToken(db: Pick<Db, "execute">, token: string): Promise<PeekedToken | null> {
  if (!token || token.length > 200) return null;
  const res = await db.execute(
    sql`select t.user_id as "userId", u.username, u.display_name as "displayName", t.purpose
        from activation_tokens t join users u on u.id = t.user_id
        where t.token_hash = ${sha256Hex(token)}
          and t.used_at is null and t.expires_at > now()`,
  );
  return rowsOf<PeekedToken>(res)[0] ?? null;
}
