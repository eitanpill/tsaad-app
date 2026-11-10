import "server-only";
import { readEnv } from "@/config";
import { constantTimeEqual } from "@/lib/auth/crypto";

/** אותו מינימום כמו ב־env.ts. */
export const MIN_CRON_SECRET_LENGTH = 16;

/**
 * בדיקת `Authorization: Bearer ${CRON_SECRET}` בזמן קבוע. נכשל סגור: אם הסוד לא הוגדר
 * או קצר מדי, אף בקשה לא תעבור (גם לא כזו בלי כותרת).
 */
export function isCronAuthorized(
  request: Request,
  secret: string | undefined = readEnv().CRON_SECRET,
): boolean {
  if (!secret || secret.length < MIN_CRON_SECRET_LENGTH) return false;
  const header = request.headers.get("authorization") ?? "";
  // משווים תמיד, כדי שהזמן לא יסגיר אם הכותרת חסרה או בפורמט שגוי.
  const ok = constantTimeEqual(header, `Bearer ${secret}`);
  return ok;
}

const NO_STORE = { "Cache-Control": "no-store" };

export const unauthorized = () =>
  Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

export const jsonNoStore = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: NO_STORE });
