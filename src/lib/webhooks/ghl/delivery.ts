import "server-only";
import { appendFileSync } from "node:fs";
import { getConfig, readEnv } from "@/config";
import { logger, type Logger } from "@/lib/logger";
import { getLinkDelivery, type LinkDelivery } from "@/lib/ghl/link-delivery";
import { renderMessage, type MessageChannel } from "@/lib/messaging/sender";
import { withStartDate } from "@/lib/format";
import { testClockAllowed } from "@/lib/today/test-clock";

/**
 * נמל המשלוח של הרשמה דרך GHL: מקבל משתמש חדש (או קישור חדש לחשבון שלא הופעל) ואחראי שהמשתתף/ת יקבל/תקבל
 * WhatsApp ודוא"ל עם שם המשתמש והקישור החד־פעמי. ההרכבה (הנוסח מ־copy.messages.activation) נעשית כאן, והמתאם
 * רק מוסר. המתאם היחיד היום הוא dry-run: לא מתקשר עם שום שירות. מתאם אמיתי (שער G3) הוא אחת משתי אפשרויות,
 * ראו docs/FILE_PLAN.md "GHL link: delivery options":
 *  (א) קריאה ל־API של GHL שכותבת את הקישור לשדה מותאם באיש הקשר ומפעילה Workflow ששולח את ההודעות;
 *  (ב) החזרת הקישור בתשובת ה־webhook ל־Workflow (דורש לשנות את הנמל כך שהמשלוח יתבצע בתוך הבקשה ויחזיר שדות).
 * מתאם אמיתי חייב לסרב לשלוח הודעה שנשארו בה מציינים לא מולאים (ראו hasUnresolvedPlaceholder).
 */
export type SignupMessage = { channel: MessageChannel; subject?: string; body: string };

export type SignupDeliveryRequest = {
  userId: string;
  ghlContactId: string;
  username: string;
  /** הקישור החד־פעמי המלא. אסור לרשום אותו ביומן. */
  link: string;
  expiresAt: Date;
  /** ההודעות המוכנות: WhatsApp אם יש טלפון, דוא"ל אם יש אימייל. */
  messages: SignupMessage[];
};

export interface SignupDelivery {
  readonly name: string;
  deliver(request: SignupDeliveryRequest): Promise<void>;
}

/** "[START_DATE]" וכדומה: מציין שלא מולא (למשל START_DATE לא הוגדר). */
export const hasUnresolvedPlaceholder = (text: string) => /\[[A-Z][A-Z0-9_]{2,}\]/.test(text);

export function composeSignupMessages(args: {
  name: string;
  username: string;
  link: string;
  userId: string;
  hasEmail: boolean;
  hasPhone: boolean;
  startDate: string | undefined;
}): SignupMessage[] {
  const base = { kind: "activation" as const, userId: args.userId, name: args.name, username: args.username, link: args.link };
  const out: SignupMessage[] = [];
  const channels: MessageChannel[] = [...(args.hasPhone ? ["whatsapp" as const] : []), ...(args.hasEmail ? ["email" as const] : [])];
  for (const channel of channels) {
    const r = renderMessage({ ...base, channel });
    out.push({
      channel,
      ...(r.subject !== undefined ? { subject: withStartDate(r.subject, args.startDate) } : {}),
      body: withStartDate(r.body, args.startDate),
    });
  }
  return out;
}

/** "יבש": לא שולח כלום. ביומן רק סוג, ערוץ, מזהה משתמש ואורכים. לעולם לא הקישור או פרטי קשר. */
export function createDryRunDelivery(log: Logger = logger): SignupDelivery {
  return {
    name: "dry-run",
    async deliver(req) {
      for (const m of req.messages) {
        log.info("signup delivery dry-run (not sent)", {
          kind: "activation",
          channel: m.channel,
          userId: req.userId,
          bodyLength: m.body.length,
          unresolvedPlaceholders: hasUnresolvedPlaceholder(m.body) || hasUnresolvedPlaceholder(m.subject ?? ""),
        });
      }
    },
  };
}

/**
 * ללכידה בבדיקות e2e בלבד: מוסיף שורת JSON {userId, username, link} לקובץ. מופעל רק כש־captureAllowed (ראו למטה).
 * (אפשר ללכוד גם בלי קובץ, בבדיקות יחידה/אינטגרציה, פשוט על ידי הזרקת מתאם.)
 */
export function createCaptureDelivery(file: string): SignupDelivery {
  return {
    name: "e2e-capture",
    async deliver(req) {
      appendFileSync(file, `${JSON.stringify({ userId: req.userId, username: req.username, link: req.link })}\n`, { mode: 0o600 });
    },
  };
}

/**
 * ההגנה לכלי הלכידה: אותה הגנה כמו שעון הבדיקות (לא ב־Vercel; בפרודקשן רק עם TSAAD_E2E=1 ו־APP_ORIGIN של loopback)
 * ובנוסף קובץ במשתנה TSAAD_WEBHOOK_CAPTURE_FILE (נתיב מוחלט). פריסה אמיתית לא יכולה לקיים את התנאים.
 */
export function captureFileFor(env: Record<string, string | undefined> = readEnv()): string | null {
  const file = env.TSAAD_WEBHOOK_CAPTURE_FILE;
  if (!file || !file.startsWith("/") || !testClockAllowed(env)) return null;
  return file;
}

/** משלוח דרך GHL (שדה מותאם ותג): ההודעות עצמן ב־Workflow של GHL, ולכן ההודעות המורכבות כאן לא נשלחות. */
export function createGhlSignupDelivery(link: LinkDelivery): SignupDelivery {
  return {
    name: "ghl",
    async deliver(req) {
      await link.deliver({ userId: req.userId, ghlContactId: req.ghlContactId, kind: "activate", link: req.link });
    },
  };
}

let delivery: SignupDelivery | undefined;

/**
 * לכידת בדיקות e2e, אחרת GHL (כש־GHL_DELIVERY_MODE הוא dry או live), אחרת dry-run כמו קודם (off, ברירת המחדל).
 */
export function getSignupDelivery(): SignupDelivery {
  if (!delivery) {
    const file = captureFileFor();
    const ghl = file ? null : getLinkDelivery();
    delivery = file ? createCaptureDelivery(file) : ghl ? createGhlSignupDelivery(ghl) : createDryRunDelivery();
  }
  return delivery;
}

export const signupStartDate = () => getConfig().env.START_DATE;
