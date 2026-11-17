import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { rowsOf } from "@/lib/auth/sql";

type Exec = Pick<Db, "execute">;

export type WhatsappReminderPref = { on: boolean; hasContact: boolean };

/** ההעדפה של המשתמש לתזכורת בוואטסאפ, והאם יש לו איש קשר ב־GHL (בלעדיו אין תזכורת בוואטסאפ בכלל). */
export async function getWhatsappReminderPref(db: Exec, userId: string): Promise<WhatsappReminderPref | null> {
  const row = rowsOf<{ on: boolean; has_contact: boolean }>(
    await db.execute(
      sql`select whatsapp_reminders as "on", ghl_contact_id is not null as has_contact from users where id = ${userId}`,
    ),
  )[0];
  return row ? { on: row.on, hasContact: row.has_contact } : null;
}

/** שומר את ההעדפה. מחזיר את הערך השמור, או null אם המשתמש לא קיים. */
export async function setWhatsappReminderPref(db: Exec, userId: string, on: boolean): Promise<boolean | null> {
  const row = rowsOf<{ on: boolean }>(
    await db.execute(sql`update users set whatsapp_reminders = ${on} where id = ${userId} returning whatsapp_reminders as "on"`),
  )[0];
  return row ? row.on : null;
}

/** שעת התזכורת של המשתמש (דקות מחצות, שעון ישראל), או null אם המשתמש לא קיים. */
export async function getReminderTime(db: Exec, userId: string): Promise<number | null> {
  const row = rowsOf<{ t: number }>(await db.execute(sql`select reminder_time as t from users where id = ${userId}`))[0];
  return row ? Number(row.t) : null;
}

/** שומר את שעת התזכורת (הקורא כבר אימת שהיא אחת מהבחירות; ה־CHECK ב־DB הוא הרשת השנייה). מחזיר את הערך השמור, או null (משתמש לא קיים או מושבת). */
export async function setReminderTime(db: Exec, userId: string, minutes: number): Promise<number | null> {
  const row = rowsOf<{ t: number }>(
    await db.execute(sql`update users set reminder_time = ${minutes} where id = ${userId} and disabled_at is null returning reminder_time as t`),
  )[0];
  return row ? Number(row.t) : null;
}
