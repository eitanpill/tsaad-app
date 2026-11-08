import "server-only";
import { REMINDERS } from "@/config/constants";
import { isAllowedPushEndpoint } from "./endpoints";

export type PushSubscriptionData = { endpoint: string; p256dh: string; auth: string };

export type PushSendResult =
  | { ok: true }
  /** gone: שירות ה־push החזיר 404/410 (או כתובת לא מותרת), והמנוי צריך להימחק. */
  | { ok: false; gone: boolean; statusCode?: number };

export interface PushSender {
  /** true: לא שולח כלום (ברירת מחדל). */
  readonly dryRun: boolean;
  send(sub: PushSubscriptionData, payload: string): Promise<PushSendResult>;
}

/** שולח "יבש": לא נוגע ברשת. */
export function createDryRunPushSender(): PushSender {
  return { dryRun: true, async send() { return { ok: true }; } };
}

export type VapidDetails = { subject: string; publicKey: string; privateKey: string };

type SendNotification = (
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  options: { vapidDetails: VapidDetails; TTL: number; urgency: "normal"; timeout: number },
) => Promise<unknown>;

/** התראה מועילה רק באותו בוקר, ולכן ה־TTL קצר (6 שעות). */
const TTL_SECONDS = 6 * 60 * 60;
const TIMEOUT_MS = 10_000;

/**
 * השולח האמיתי (חבילת web-push). נבחר רק מ־getPushSender כש־REMINDERS_ENABLED הוא true
 * ויש מפתחות VAPID. `sendNotification` ניתן להזרקה לבדיקות (בלי רשת).
 */
export function createWebPushSender(
  vapid: VapidDetails,
  sendNotification?: SendNotification,
  deadlineMs: number = REMINDERS.sendDeadlineMs,
): PushSender {
  return {
    dryRun: false,
    async send(sub, payload) {
      // הגנה בעומק: גם מנוי שנשמר במסד נבדק מול רשימת ההיתר לפני כל בקשה.
      if (!isAllowedPushEndpoint(sub.endpoint)) return { ok: false, gone: true };
      try {
        const send = sendNotification ?? ((await import("web-push")).sendNotification as SendNotification);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("push deadline exceeded")), deadlineMs);
        });
        try {
          await Promise.race([
            send(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
              { vapidDetails: vapid, TTL: TTL_SECONDS, urgency: "normal", timeout: TIMEOUT_MS },
            ),
            deadline,
          ]);
        } finally {
          clearTimeout(timer);
        }
        return { ok: true };
      } catch (e) {
        const statusCode = (e as { statusCode?: unknown } | null)?.statusCode;
        const code = typeof statusCode === "number" ? statusCode : undefined;
        return { ok: false, gone: code === 404 || code === 410, statusCode: code };
      }
    },
  };
}

export function readVapid(env: {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}): VapidDetails | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return null;
  return { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
}

/**
 * ברירת המחדל dry-run. שולח אמיתי רק כש־reminders הוא בדיוק true ויש VAPID מלא.
 */
export function getPushSender(
  remindersEnabled: boolean,
  env: Parameters<typeof readVapid>[0],
): PushSender {
  if (remindersEnabled !== true) return createDryRunPushSender();
  const vapid = readVapid(env);
  return vapid ? createWebPushSender(vapid) : createDryRunPushSender();
}

