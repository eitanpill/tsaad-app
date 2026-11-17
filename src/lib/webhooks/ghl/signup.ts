import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { RATE_LIMITS } from "@/lib/auth/config";
import { rateLimitKeys, registerAttempt } from "@/lib/auth/rate-limit";
import { rowsOf } from "@/lib/auth/sql";
import { issueTokenIn } from "@/lib/auth/tokens";
import type { Logger } from "@/lib/logger";
import type { SignupPayload } from "./payload";
import { USERNAME_MAX, usernameBase, usernameCandidate, usernameRandomCandidate } from "./username";

export type SignupStatus = "created" | "reissued" | "exists" | "duplicate";

export type IssuedLink = {
  userId: string;
  username: string;
  displayName: string;
  hasEmail: boolean;
  hasPhone: boolean;
  token: string;
  expiresAt: Date;
};

export type SignupOutcome = { status: SignupStatus; issued?: IssuedLink };

/** סיומות רציפות (dana .. dana50), ואחריהן עוד ניסיונות עם סיומת אקראית, כדי שמילוי מכוון של הסיומות לא יחסום הרשמה. */
const SEQUENTIAL_USERNAME_TRIES = 50;
const RANDOM_USERNAME_TRIES = 20;
const MAX_USERNAME_TRIES = SEQUENTIAL_USERNAME_TRIES + RANDOM_USERNAME_TRIES;

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  password_hash: string | null;
  activated_at: Date | string | null;
  disabled_at: Date | string | null;
};

/**
 * עיבוד הרשמה אחת, כולו בטרנזקציה אחת (המשתמש, הקישור ומזהה האירוע מתחייבים יחד או לא בכלל,
 * כך שכשל באמצע משאיר את האירוע לא מעובד ו־GHL יכול לנסות שוב):
 *  1. נעילת מייעצת לפי איש הקשר: בקשות מקבילות לאותו איש קשר מתבצעות בזו אחר זו.
 *  2. רישום מזהה האירוע (ייחודי). כבר קיים: "duplicate", בלי לגעת בכלום.
 *  3. איש קשר קיים (ghl_contact_id): מושבת (disabled_at) או מופעל = "exists" (לא משנים כלום); לא מופעל = קישור חדש, הישן מתבטל
 *     ("reissued"), עד RATE_LIMITS.webhookReissue בשעה, ומעבר לזה "exists" בלי קישור חדש.
 *  4. אחרת: משתמש חדש (שם משתמש לפי username.ts) וקישור הפעלה ("created").
 * האסימון חוזר רק בזיכרון (לשכבת המשלוח); במסד נשמר ה־hash בלבד.
 */
export async function processSignup(
  db: Db,
  args: {
    eventId: string;
    payload: SignupPayload;
    ttlMinutes: number;
    rateLimitSecret: string;
    log: Logger;
    random?: () => number;
  },
): Promise<SignupOutcome> {
  const { payload } = args;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ghl-signup:${payload.ghlContactId}`}))`);

    const inserted = await tx.execute(
      sql`insert into webhook_events (event_id, source) values (${args.eventId}, 'ghl')
          on conflict (event_id) do nothing returning id`,
    );
    if (rowsOf(inserted).length === 0) return { status: "duplicate" };

    const existing = rowsOf<UserRow>(
      await tx.execute(
        sql`select id, username, display_name, email, phone, password_hash, activated_at, disabled_at
            from users where ghl_contact_id = ${payload.ghlContactId} for update`,
      ),
    )[0];

    if (existing) {
      // משתתף/ת מושבת/ת: ההרשמה החוזרת אף פעם לא מפעילה מחדש ולא מנפיקה קישור. רק בעל האתר מפעיל מחדש (/admin/participants).
      if (existing.disabled_at !== null) {
        args.log.info("ghl signup: account disabled, nothing done", { userId: existing.id });
        return { status: "exists" };
      }
      if (existing.password_hash !== null || existing.activated_at !== null) {
        args.log.info("ghl signup: already activated, nothing done", { userId: existing.id });
        return { status: "exists" };
      }
      // קישורים יוצאים במייל בלבד: אם נרשמו בלי מייל ובינתיים נוסף מייל לאיש הקשר ב־GHL, משלימים אותו (רק כשהשדה ריק,
      // ורק בחשבון שעוד לא הופעל), אחרת הקישור החוזר וגם "שכחתי סיסמה" לא היו נשלחים לעולם.
      let email = existing.email;
      if (!email && payload.email) {
        await tx.execute(sql`update users set email = ${payload.email} where id = ${existing.id} and email is null`);
        email = payload.email;
      }
      const limit = await registerAttempt(
        tx,
        "webhook",
        rateLimitKeys(args.rateLimitSecret, `reissue:${payload.ghlContactId}`, null),
        {
          windowSeconds: RATE_LIMITS.webhookReissue.windowSeconds,
          perIdentifier: RATE_LIMITS.webhookReissue.perIdentifier,
          perIp: RATE_LIMITS.webhookReissue.perIp,
        },
      );
      if (!limit.allowed) {
        args.log.warn("ghl signup: reissue rate limited, no new link", { userId: existing.id });
        return { status: "exists" };
      }
      const { token, expiresAt } = await issueTokenIn(tx, {
        userId: existing.id,
        purpose: "activate",
        ttlMinutes: args.ttlMinutes,
      });
      return {
        status: "reissued",
        issued: {
          userId: existing.id,
          username: existing.username,
          displayName: existing.display_name,
          hasEmail: !!email,
          hasPhone: !!existing.phone,
          token,
          expiresAt,
        },
      };
    }

    const base = usernameBase({ email: payload.email, phoneE164: payload.phoneE164 }, args.random);
    let userId: string | null = null;
    let username = base;
    let displayName = payload.displayName ?? base;
    for (let n = 1; n <= MAX_USERNAME_TRIES && userId === null; n++) {
      username =
        n <= SEQUENTIAL_USERNAME_TRIES ? usernameCandidate(base, n) : usernameRandomCandidate(base, args.random);
      displayName = payload.displayName ?? username;
      const res = await tx.execute(
        sql`insert into users (username, display_name, email, phone, ghl_contact_id)
            values (${username}, ${displayName}, ${payload.email}, ${payload.phoneE164}, ${payload.ghlContactId})
            on conflict (username) do nothing returning id`,
      );
      userId = rowsOf<{ id: string }>(res)[0]?.id ?? null;
    }
    if (userId === null) throw new Error(`no free username after ${MAX_USERNAME_TRIES} tries (max length ${USERNAME_MAX})`);

    const { token, expiresAt } = await issueTokenIn(tx, { userId, purpose: "activate", ttlMinutes: args.ttlMinutes });
    return {
      status: "created",
      issued: {
        userId,
        username,
        displayName,
        hasEmail: !!payload.email,
        hasPhone: !!payload.phoneE164,
        token,
        expiresAt,
      },
    };
  });
}
