import { createECDH, randomBytes } from "node:crypto";

/** מפתחות מנוי תקינים וחד־פעמיים לבדיקות (לא סודות, לא נשמרים בשום מקום). */
export function fakeSubscription(endpoint = `https://fcm.googleapis.com/fcm/send/${randomBytes(12).toString("hex")}`) {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint,
    keys: {
      p256dh: ecdh.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  };
}

/** מפתח VAPID ציבורי (65 בתים, base64url) חד־פעמי. */
export function fakeVapidPublicKey(): string {
  return fakeSubscription().keys.p256dh;
}
