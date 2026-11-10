import "server-only";
import { createPublicKey } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { REMINDERS } from "@/config/constants";
import type { Db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { sha256Hex } from "@/lib/auth/crypto";
import { rowsOf } from "@/lib/auth/sql";
import { isAllowedPushEndpoint, MAX_ENDPOINT_LENGTH } from "./endpoints";

/**
 * מנוי התראות מהדפדפן (PushSubscription.toJSON()). הכול קלט לא אמין:
 *  - endpoint: https בלבד ומרשימת ההיתר של שירותי ה־push (isAllowedPushEndpoint), כדי שהשרת לא יישלח לכתובת שרירותית (SSRF).
 *  - p256dh: base64url של נקודה לא דחוסה על עקום P-256: 65 בתים, הראשון 0x04, והנקודה חייבת להיות על העקום.
 *  - auth: base64url של בדיוק 16 בתים.
 * base64url בלי ריפוד ("="): כך הדפדפן מוציא אותם, וכך web-push מצפה להם.
 */
const B64URL = /^[A-Za-z0-9_-]+$/;

function decodeB64Url(v: string): Buffer | null {
  if (!B64URL.test(v) || v.length % 4 === 1) return null;
  return Buffer.from(v, "base64url");
}

// SPKI של עקום prime256v1 (תחילית קבועה) + הנקודה: createPublicKey זורק אם היא לא על העקום.
const SPKI_P256_PREFIX = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex");

export function isValidP256dh(v: unknown): v is string {
  if (typeof v !== "string" || v.length !== 87) return false; // 65 בתים = 87 תווי base64url
  const raw = decodeB64Url(v);
  if (!raw || raw.length !== 65 || raw[0] !== 0x04) return false;
  try {
    createPublicKey({ key: Buffer.concat([SPKI_P256_PREFIX, raw]), format: "der", type: "spki" });
    return true;
  } catch {
    return false;
  }
}

export function isValidAuthSecret(v: unknown): v is string {
  if (typeof v !== "string" || v.length !== 22) return false; // 16 בתים = 22 תווי base64url
  const raw = decodeB64Url(v);
  return !!raw && raw.length === 16;
}

export const subscribeSchema = z.object({
  endpoint: z.string().max(MAX_ENDPOINT_LENGTH).refine(isAllowedPushEndpoint, "endpoint not allowed"),
  keys: z.object({
    p256dh: z.string().refine(isValidP256dh, "invalid p256dh"),
    auth: z.string().refine(isValidAuthSecret, "invalid auth"),
  }),
});

export const unsubscribeSchema = z.object({ endpoint: z.string().min(1).max(MAX_ENDPOINT_LENGTH) });

export type SubscribeInput = z.infer<typeof subscribeSchema>;

export type SaveResult =
  | { ok: true; created: boolean; evicted: number }
  /** conflict: הכתובת כבר שייכת למשתמש אחר, והמפתחות שונים. */
  | { ok: false; error: "conflict" };

/**
 * שומר מנוי למשתמש (upsert לפי endpoint) ומגביל ל־REMINDERS.maxSubscriptionsPerUser: כשיש יותר, נמחקים הוותיקים.
 *
 * כתובת שכבר קיימת:
 *  - אצל אותו משתמש: המפתחות מתעדכנים והמנוי נחשב חדש (created_at מתעדכן, כך שהוא האחרון להיפלט).
 *  - אצל משתמש אחר: מועברים למשתמש הנוכחי רק אם p256dh ו־auth זהים למה ששמור. זה המקרה הלגיטימי היחיד
 *    (אותו מכשיר, התחברות עם חשבון אחר: למנוי של הדפדפן יש כתובת ומפתחות קבועים). מי שמכיר רק את הכתובת
 *    אינו יכול "לחטוף" אותה, כי הוא לא מכיר את המפתחות של המכשיר; מפתחות שונים מקבלים conflict.
 *    הכתובת עצמה היא סוד שקשה לנחש, ושליחה אליה נשארת מוגבלת לרשימת ההיתר.
 * נעילה (pg_advisory_xact_lock) לפי משתמש: רישומים מקבילים לא עוקפים את התקרה.
 */
export async function saveSubscription(db: Db, userId: string, sub: SubscribeInput): Promise<SaveResult> {
  const { endpoint, keys } = sub;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`push:${userId}`}, 0))`);
    const [existing] = await tx
      .select({ userId: pushSubscriptions.userId, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
    if (existing && existing.userId !== userId && (existing.p256dh !== keys.p256dh || existing.auth !== keys.auth)) {
      return { ok: false as const, error: "conflict" as const };
    }
    // The same rule again inside the upsert: the lock above is per user, so a row for this endpoint that another
    // user created concurrently (after the select) is only taken over when its keys match. Otherwise nothing is written.
    const written = await tx
      .insert(pushSubscriptions)
      .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh: keys.p256dh, auth: keys.auth, createdAt: sql`now()` },
        setWhere: sql`${pushSubscriptions.userId} = ${userId}
          or (${pushSubscriptions.p256dh} = ${keys.p256dh} and ${pushSubscriptions.auth} = ${keys.auth})`,
      })
      .returning({ id: pushSubscriptions.id });
    if (written.length === 0) return { ok: false as const, error: "conflict" as const };
    const evicted = await tx.execute(
      sql`delete from push_subscriptions
           where user_id = ${userId}
             and id not in (
               select id from push_subscriptions where user_id = ${userId}
                order by created_at desc, id desc limit ${REMINDERS.maxSubscriptionsPerUser})
          returning id`,
    );
    return {
      ok: true as const,
      created: !existing || existing.userId !== userId,
      evicted: rowsOf<{ id: string }>(evicted).length,
    };
  });
}

/**
 * האם המנוי של המכשיר הזה (endpoint + מפתחות) רשום למשתמש הנוכחי. נקרא מהלקוח בטעינת האפליקציה ובמסך התזכורות.
 * אם אותו מכשיר בדיוק (אותה כתובת ואותם מפתחות) רשום למשתמש אחר, השורה שלו נמחקת: בדפדפן הזה מחובר עכשיו
 * משתמש אחר (למשל טלפון משותף, בלי יציאה מסודרת), והתזכורות של הקודם לא אמורות להגיע לכאן. השורה לא מועברת
 * למשתמש הנוכחי: הוא לא ביקש תזכורות. הלקוח מבטל את המנוי המקומי כשהתשובה היא false.
 */
export async function checkSubscription(db: Db, userId: string, sub: SubscribeInput): Promise<boolean> {
  const { endpoint, keys } = sub;
  const [row] = await db
    .select({ userId: pushSubscriptions.userId, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
  if (!row) return false;
  const sameKeys = row.p256dh === keys.p256dh && row.auth === keys.auth;
  if (row.userId === userId) return sameKeys;
  if (sameKeys) {
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, endpoint),
          eq(pushSubscriptions.userId, row.userId),
          eq(pushSubscriptions.p256dh, keys.p256dh),
          eq(pushSubscriptions.auth, keys.auth),
        ),
      );
  }
  return false;
}

/**
 * ביציאה: מוחק את המנוי של המכשיר הזה, אם הוא שייך למשתמש של ההתחברות שנסגרת (לפי האסימון, גם אם פג תוקפו).
 * כך טלפון משותף לא ממשיך לקבל את התזכורות של מי שיצא. אידמפוטנטי.
 */
export async function removeSubscriptionForSession(db: Db, sessionToken: string, endpoint: string): Promise<number> {
  if (!sessionToken || sessionToken.length > 200 || !endpoint || endpoint.length > MAX_ENDPOINT_LENGTH) return 0;
  const res = await db.execute(
    sql`delete from push_subscriptions
         where endpoint = ${endpoint}
           and user_id = (select user_id from sessions where token_hash = ${sha256Hex(sessionToken)})
        returning id`,
  );
  return rowsOf<{ id: string }>(res).length;
}

/** מוחק מנוי של המשתמש הנוכחי בלבד. אידמפוטנטי: מחזיר כמה נמחקו. */
export async function removeSubscription(db: Db, userId: string, endpoint: string): Promise<number> {
  const rows = await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .returning({ id: pushSubscriptions.id });
  return rows.length;
}
