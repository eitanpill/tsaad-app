import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import type { LinkDelivery } from "@/lib/ghl/link-delivery";
import type { MessageSender } from "@/lib/messaging/sender";
import { logger } from "@/lib/logger";
import { RATE_LIMITS } from "./config";
import { hmacHex } from "./crypto";
import { rateLimitKeys, registerAttempt } from "./rate-limit";
import { rowsOf } from "./sql";
import { issueToken, type TokenPurpose } from "./tokens";

export const IDENTIFIER_MAX_LENGTH = 254;
const MAX_MATCHES = 5;

/** מספר טלפון לצורה השוואתית: ספרות בלבד; 972… ו־+972… הופכים ל־0… . */
export function phoneCandidates(input: string): string[] {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 7) return [];
  const out = new Set([digits]);
  if (digits.startsWith("972")) out.add("0" + digits.slice(3));
  if (digits.startsWith("0")) out.add("972" + digits.slice(1));
  return [...out];
}

type Match = {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  password_hash: string | null;
  ghl_contact_id: string | null;
};

export type ForgotResult = { status: "ok" } | { status: "rate_limited"; retryAfterSeconds: number };

/**
 * "שכחתי סיסמה". התוצאה החיצונית זהה בין אם יש חשבון ובין אם אין ("ok"); רק חריגה
 * ממגבלת הקצב (שתלויה בקלט בלבד, לא בקיום החשבון) מחזירה תשובה אחרת.
 * חשבון שעוד לא הופעל מקבל קישור הפעלה, חשבון מופעל מקבל קישור איפוס.
 * הקישור נשלח לפרטי הקשר שבחשבון, לא לכתובת שהוקלדה.
 */
export async function requestPasswordReset(
  db: Db,
  args: {
    identifier: string;
    secret: string;
    ip?: string | null;
    ttlMinutes: number;
    sender: MessageSender;
    origin: string;
    /**
     * מריץ את המשלוח (הנפקת קישור ושליחה). בשרת: `after` של Next, כדי שהמשלוח ירוץ אחרי
     * התשובה וזמן התגובה לא יגלה אם יש חשבון (גם כשהשולח האמיתי איטי). בלי ערך: ממתינים לו כאן.
     */
    defer?: (task: () => Promise<void>) => void;
    /** מסירה דרך GHL (שדה מותאם ותג) למי שיש לו ghl_contact_id; בלי ערך, או למי שאין לו איש קשר: השולח הרגיל. */
    ghl?: LinkDelivery | null;
  },
): Promise<ForgotResult> {
  const identifier = args.identifier.trim().toLowerCase().slice(0, IDENTIFIER_MAX_LENGTH);
  const keys = rateLimitKeys(args.secret, identifier, args.ip);
  const limit = await registerAttempt(db, "forgot", keys);
  if (!limit.allowed) return { status: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds };

  const phones = phoneCandidates(identifier);
  const phoneClause = phones.length
    ? sql` or regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = any(array[${sql.join(
        phones.map((p) => sql`${p}`),
        sql`, `,
      )}]::text[])`
    : sql``;
  const res = await db.execute(
    sql`select id, username, display_name, email, phone, password_hash, ghl_contact_id from users
        where username = ${identifier} or lower(email) = ${identifier}${phoneClause}
        order by created_at
        limit ${MAX_MATCHES}`,
  );

  const matches = rowsOf<Match>(res);
  const deliver = async () => {
    for (const u of matches) {
      try {
        // מגבלה לכל חשבון (לא רק לכל מזהה): אחרת אפשר להציף משתמש בהודעות דרך כתיבים שונים
        // של אותו טלפון או מייל. חריגה מדולגת בשקט; התשובה החיצונית כבר נקבעה.
        const perAccount = await registerAttempt(
          db,
          "forgot",
          { identifierHash: hmacHex(args.secret, "rl-user", u.id), ipHash: null },
          {
            windowSeconds: RATE_LIMITS.forgotPerAccount.windowSeconds,
            perIdentifier: RATE_LIMITS.forgotPerAccount.max,
            perIp: Number.POSITIVE_INFINITY,
          },
        );
        if (!perAccount.allowed) continue;
        const purpose: TokenPurpose = u.password_hash ? "reset" : "activate";
        const { token } = await issueToken(db, { userId: u.id, purpose, ttlMinutes: args.ttlMinutes });
        const link = `${args.origin}/activate?token=${token}`;
        if (args.ghl && u.ghl_contact_id) {
          await args.ghl.deliver({ userId: u.id, ghlContactId: u.ghl_contact_id, kind: purpose, link });
          continue;
        }
        const base = { kind: purpose === "reset" ? ("reset" as const) : ("activation" as const), userId: u.id, name: u.display_name, username: u.username, link };
        if (u.email) await args.sender.send({ ...base, channel: "email" });
        if (u.phone) await args.sender.send({ ...base, channel: "whatsapp" });
      } catch (e) {
        // כשל פנימי לא משנה את התשובה החיצונית (אחרת היא תגלה אם יש חשבון).
        logger.error("password reset delivery failed", { error: e });
      }
    }
  };
  if (args.defer) args.defer(deliver);
  else await deliver();
  return { status: "ok" };
}
