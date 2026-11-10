import "server-only";
import { createPublicKey } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { REMINDERS } from "@/config/constants";
import type { Db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
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
    await tx
      .insert(pushSubscriptions)
      .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh: keys.p256dh, auth: keys.auth, createdAt: sql`now()` },
      });
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

/** מוחק מנוי של המשתמש הנוכחי בלבד. אידמפוטנטי: מחזיר כמה נמחקו. */
export async function removeSubscription(db: Db, userId: string, endpoint: string): Promise<number> {
  const rows = await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .returning({ id: pushSubscriptions.id });
  return rows.length;
}
