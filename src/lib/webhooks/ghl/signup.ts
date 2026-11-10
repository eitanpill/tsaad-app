import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { RATE_LIMITS } from "@/lib/auth/config";
import { rateLimitKeys, registerAttempt } from "@/lib/auth/rate-limit";
import { rowsOf } from "@/lib/auth/sql";
import { issueTokenIn } from "@/lib/auth/tokens";
import type { Logger } from "@/lib/logger";
import type { SignupPayload } from "./payload";
import { USERNAME_MAX, usernameBase, usernameCandidate } from "./username";

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

const MAX_USERNAME_TRIES = 200;

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  password_hash: string | null;
  activated_at: Date | string | null;
};

/**
 * עיבוד הרשמה אחת, כולו בטרנזקציה אחת (המשתמש, הקישור ומזהה האירוע מתחייבים יחד או לא בכלל,
 * כך שכשל באמצע משאיר את האירוע לא מעובד ו־GHL יכול לנסות שוב):
 *  1. נעילת מייעצת לפי איש הקשר: בקשות מקבילות לאותו איש קשר מתבצעות בזו אחר זו.
 *  2. רישום מזהה האירוע (ייחודי). כבר קיים: "duplicate", בלי לגעת בכלום.
 *  3. איש קשר קיים (ghl_contact_id): מופעל = "exists" (לא משנים כלום); לא מופעל = קישור חדש, הישן מתבטל
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
        sql`select id, username, display_name, email, phone, password_hash, activated_at
            from users where ghl_contact_id = ${payload.ghlContactId} for update`,
      ),
    )[0];

    if (existing) {
      if (existing.password_hash !== null || existing.activated_at !== null) {
        args.log.info("ghl signup: already activated, nothing done", { userId: existing.id });
        return { status: "exists" };
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
          hasEmail: !!existing.email,
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
      username = usernameCandidate(base, n);
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
