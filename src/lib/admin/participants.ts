import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { rowsOf } from "@/lib/auth/sql";
import { issueTokenIn, type TokenPurpose } from "@/lib/auth/tokens";
import { cleanName, normalizeEmail, normalizePhoneIL } from "@/lib/webhooks/ghl/normalize";
import { USERNAME_MAX, usernameBase, usernameCandidate, usernameRandomCandidate } from "@/lib/webhooks/ghl/username";

/**
 * ניהול משתתפים בידי בעל האתר (/admin/participants) ויצירת חשבון מהסקריפט scripts/admin-create-user.ts.
 * אין כאן שליחה לשום מקום: הקישור החד־פעמי חוזר בזיכרון בלבד (במסד נשמר רק ה־hash), והבעלים שולח אותו בעצמו.
 * ללא תלות ב־next/headers או ב־getConfig, כדי שהסקריפט יוכל לייבא את המודול.
 */

/** כמו בהרשמה דרך GHL (signup.ts): סיומות רציפות, ואחריהן סיומת אקראית. */
const SEQUENTIAL_USERNAME_TRIES = 50;
const RANDOM_USERNAME_TRIES = 20;

export const ADMIN_USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,38}[a-z0-9])$/;

export type IssuedLink = { token: string; expiresAt: Date };

export type CreateParticipantInput = {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  /** שם משתמש מפורש (הסקריפט). בלי ערך: נגזר כמו ב־webhook. */
  username?: string;
  ttlMinutes: number;
  random?: () => number;
};

export type CreateParticipantResult =
  | { ok: true; userId: string; username: string; link: IssuedLink }
  | { ok: false; error: "invalid_name" | "invalid_contact" | "username_taken" | "invalid_username" };

/** ניקוי קלט: שם (cleanName), אימייל וטלפון (נרמול כמו ב־webhook). null בקלט ריק; "invalid" בקלט לא תקין. */
export function normalizeContact(input: { email?: string | null; phone?: string | null }):
  | { ok: true; email: string | null; phone: string | null }
  | { ok: false } {
  const rawEmail = input.email?.trim() ?? "";
  const rawPhone = input.phone?.trim() ?? "";
  const email = rawEmail ? normalizeEmail(rawEmail) : null;
  const phone = rawPhone ? normalizePhoneIL(rawPhone) : null;
  if ((rawEmail && !email) || (rawPhone && !phone) || (!email && !phone)) return { ok: false };
  return { ok: true, email, phone };
}

/**
 * יוצר משתמש וקישור הפעלה באותה טרנזקציה. אין ghl_contact_id (חשבון ידני).
 * שם המשתמש: מפורש (ייכשל אם תפוס), או נגזר בכלל של ה־webhook (usernameBase + סיומות).
 */
export async function createParticipant(db: Db, args: CreateParticipantInput): Promise<CreateParticipantResult> {
  const displayName = cleanName(args.displayName);
  if (!displayName) return { ok: false, error: "invalid_name" };
  const contact = normalizeContact(args);
  if (!contact.ok) return { ok: false, error: "invalid_contact" };
  if (args.username !== undefined && !ADMIN_USERNAME_RE.test(args.username)) return { ok: false, error: "invalid_username" };

  return db.transaction(async (tx) => {
    let userId: string | null = null;
    let username = args.username ?? "";
    if (args.username !== undefined) {
      const res = await tx.execute(
        sql`insert into users (username, display_name, email, phone)
            values (${username}, ${displayName}, ${contact.email}, ${contact.phone})
            on conflict (username) do nothing returning id`,
      );
      userId = rowsOf<{ id: string }>(res)[0]?.id ?? null;
      if (userId === null) return { ok: false as const, error: "username_taken" as const };
    } else {
      const base = usernameBase({ email: contact.email, phoneE164: contact.phone }, args.random);
      for (let n = 1; n <= SEQUENTIAL_USERNAME_TRIES + RANDOM_USERNAME_TRIES && userId === null; n++) {
        username = n <= SEQUENTIAL_USERNAME_TRIES ? usernameCandidate(base, n) : usernameRandomCandidate(base, args.random);
        const res = await tx.execute(
          sql`insert into users (username, display_name, email, phone)
              values (${username}, ${displayName}, ${contact.email}, ${contact.phone})
              on conflict (username) do nothing returning id`,
        );
        userId = rowsOf<{ id: string }>(res)[0]?.id ?? null;
      }
      if (userId === null) throw new Error(`no free username (max length ${USERNAME_MAX})`);
    }
    const link = await issueTokenIn(tx, { userId, purpose: "activate", ttlMinutes: args.ttlMinutes });
    return { ok: true as const, userId, username, link };
  });
}

export type ParticipantLinkResult =
  | { ok: true; purpose: TokenPurpose; userId: string; username: string; link: IssuedLink }
  | { ok: false; error: "not_found" | "disabled" };

/**
 * קישור חדש: להפעלה למי שעוד לא הפעיל/ה, לאיפוס סיסמה למי שהפעיל/ה. קישורים קודמים שלא נוצלו מאותה מטרה מבוטלים
 * (issueTokenIn). חשבון מושבת לא מקבל קישור. הנעילה על שורת המשתמש מונעת מרוץ מול השבתה.
 */
export async function issueParticipantLink(
  db: Db,
  args: { userId?: string; username?: string; ttlMinutes: number },
): Promise<ParticipantLinkResult> {
  if (!args.userId && !args.username) return { ok: false, error: "not_found" };
  return db.transaction(async (tx) => {
    const res = args.userId
      ? await tx.execute(
          sql`select id, username, password_hash, activated_at, disabled_at from users where id = ${args.userId} for update`,
        )
      : await tx.execute(
          sql`select id, username, password_hash, activated_at, disabled_at from users where username = ${args.username!} for update`,
        );
    const u = rowsOf<{
      id: string;
      username: string;
      password_hash: string | null;
      activated_at: unknown;
      disabled_at: unknown;
    }>(res)[0];
    if (!u) return { ok: false as const, error: "not_found" as const };
    if (u.disabled_at) return { ok: false as const, error: "disabled" as const };
    const purpose: TokenPurpose = u.password_hash !== null || u.activated_at !== null ? "reset" : "activate";
    const link = await issueTokenIn(tx, { userId: u.id, purpose, ttlMinutes: args.ttlMinutes });
    return { ok: true as const, purpose, userId: u.id, username: u.username, link };
  });
}

export type MutationResult = { ok: true } | { ok: false; error: "not_found" | "self" };

/**
 * השבתה: disabled_at, מחיקת כל ההתחברויות והקישורים שלא נוצלו, וסימון שורות תור הסנכרון הממתינות כ"מתות"
 * (מעקב ו־GHL). הכל בטרנזקציה אחת. אי אפשר להשבית את עצמך.
 */
export async function disableParticipant(db: Db, args: { userId: string; actorId: string }): Promise<MutationResult> {
  if (args.userId === args.actorId) return { ok: false, error: "self" };
  return db.transaction(async (tx) => {
    const res = await tx.execute(
      sql`update users set disabled_at = coalesce(disabled_at, now()) where id = ${args.userId} returning id`,
    );
    if (rowsOf(res).length === 0) return { ok: false as const, error: "not_found" as const };
    await tx.execute(sql`delete from sessions where user_id = ${args.userId}`);
    await tx.execute(sql`delete from activation_tokens where user_id = ${args.userId} and used_at is null`);
    await tx.execute(
      sql`update sync_outbox set status = 'dead', last_error = 'account disabled'
          where user_id = ${args.userId} and status in ('pending','failed')`,
    );
    return { ok: true as const };
  });
}

export async function enableParticipant(db: Db, args: { userId: string }): Promise<MutationResult> {
  const res = await db.execute(sql`update users set disabled_at = null where id = ${args.userId} returning id`);
  return rowsOf(res).length ? { ok: true } : { ok: false, error: "not_found" };
}

/**
 * מחיקה לצמיתות: אותה מחיקת שורת users כמו במחיקת חשבון עצמית (lib/account/delete.ts); כל הטבלאות עם מידע אישי
 * מצביעות אליה ב־ON DELETE CASCADE. מחזיר אם היה איש קשר ב־GHL (להודעת המחיקה היבשה). אי אפשר למחוק את עצמך.
 */
export async function deleteParticipant(
  db: Db,
  args: { userId: string; actorId: string },
): Promise<{ ok: true; hadGhlContact: boolean } | { ok: false; error: "not_found" | "self" }> {
  if (args.userId === args.actorId) return { ok: false, error: "self" };
  const res = await db.execute(sql`delete from users where id = ${args.userId} returning ghl_contact_id`);
  const row = rowsOf<{ ghl_contact_id: string | null }>(res)[0];
  return row ? { ok: true, hadGhlContact: row.ghl_contact_id !== null } : { ok: false, error: "not_found" };
}

export type ParticipantRow = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  activated: boolean;
  disabled: boolean;
  lastActivity: Date | null;
};

export const PARTICIPANTS_PAGE_SIZE = 25;

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const toDate = (v: unknown) => (v ? new Date(v as string | Date) : null);

/** רשימה עם חיפוש (שם, שם משתמש, אימייל, טלפון) ודפדוף. הפעילות האחרונה: הסימון האחרון או הכניסה האחרונה. */
export async function listParticipants(
  db: Db,
  args: { q?: string; page?: number; pageSize?: number },
): Promise<{ rows: ParticipantRow[]; total: number; page: number; pageSize: number }> {
  const pageSize = args.pageSize ?? PARTICIPANTS_PAGE_SIZE;
  const q = (args.q ?? "").trim().slice(0, 100);
  const pattern = `%${likeEscape(q)}%`;
  const where = q
    ? sql`where u.username ilike ${pattern} or u.display_name ilike ${pattern} or u.email ilike ${pattern} or u.phone ilike ${pattern}`
    : sql``;
  const total = rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from users u ${where}`))[0]?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(args.page ?? 1) || 1), pages);
  const res = await db.execute(
    sql`select u.id, u.username, u.display_name, u.email, u.phone, u.created_at,
               (u.password_hash is not null or u.activated_at is not null) as activated,
               (u.disabled_at is not null) as disabled,
               greatest(
                 (select max(c.completed_at) from action_completions c where c.user_id = u.id),
                 (select max(s.last_seen_at) from sessions s where s.user_id = u.id)
               ) as last_activity
          from users u ${where}
         order by u.created_at desc, u.id
         limit ${pageSize} offset ${(page - 1) * pageSize}`,
  );
  const rows = rowsOf<{
    id: string;
    username: string;
    display_name: string;
    email: string | null;
    phone: string | null;
    created_at: string | Date;
    activated: boolean;
    disabled: boolean;
    last_activity: string | Date | null;
  }>(res).map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    email: r.email,
    phone: r.phone,
    createdAt: new Date(r.created_at),
    activated: r.activated,
    disabled: r.disabled,
    lastActivity: toDate(r.last_activity),
  }));
  return { rows, total, page, pageSize };
}

export async function findParticipant(db: Db, userId: string): Promise<{ id: string; username: string } | null> {
  const res = await db.execute(sql`select id, username from users where id = ${userId}`);
  return rowsOf<{ id: string; username: string }>(res)[0] ?? null;
}
