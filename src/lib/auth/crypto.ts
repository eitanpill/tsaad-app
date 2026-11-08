import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** אסימון אקראי של 32 בתים, base64url. */
export const newToken = () => randomBytes(32).toString("base64url");

/** hash לאחסון אסימונים (גבוה באנטרופיה, ולכן sha256 מספיק). */
export const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");

/** HMAC במפתח סודי, לזיהוי בהגבלת קצב (שם משתמש ו־IP הם קלט בעל אנטרופיה נמוכה). */
export function hmacHex(secret: string, purpose: string, value: string): string {
  return createHmac("sha256", secret).update(`${purpose}\u0000${value}`).digest("hex");
}

/** השוואה בזמן קבוע של שתי מחרוזות, גם כשהאורכים שונים. */
export function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
