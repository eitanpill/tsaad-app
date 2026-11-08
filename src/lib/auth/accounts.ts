import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { consumeToken } from "./tokens";
import { rowsOf } from "./sql";

/**
 * מנצל אסימון ומגדיר סיסמה בטרנזקציה אחת: אם אחד השלבים נכשל, האסימון לא נשרף.
 * מוחק את כל ההתחברויות הקיימות של המשתמש (איפוס סיסמה מנתק מכל מכשיר)
 * ואת שאר הקישורים שלא נוצלו. מחזיר null אם האסימון לא תקף (נוצל, פג או לא קיים).
 */
export async function completePasswordSetup(
  db: Db,
  args: { token: string; passwordHash: string },
): Promise<{ userId: string; username: string } | null> {
  return db.transaction(async (tx) => {
    const consumed = await consumeToken(tx, args.token);
    if (!consumed) return null;
    const res = await tx.execute(
      sql`update users
          set password_hash = ${args.passwordHash}, activated_at = coalesce(activated_at, now())
          where id = ${consumed.userId}
          returning id as "userId", username`,
    );
    const user = rowsOf<{ userId: string; username: string }>(res)[0];
    if (!user) return null;
    await tx.execute(sql`delete from sessions where user_id = ${consumed.userId}`);
    await tx.execute(
      sql`delete from activation_tokens where user_id = ${consumed.userId} and used_at is null`,
    );
    return user;
  });
}
