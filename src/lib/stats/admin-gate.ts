import "server-only";
import { getConfig } from "@/config";
import { getDb } from "@/db";
import { getSessionSecret } from "@/lib/auth/config";
import { validateSession } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { isAdminUsername, parseAdminUsernames } from "./admin";

/**
 * בדיקת הבעלים ל־proxy.ts, לפני שהדף מתחיל להישלח: כך מי שאינו בעלים (גם מחובר) מקבל 404 אמיתי, בדיוק כמו כתובת שלא קיימת.
 * נכשל סגור: אין רשימה, אין סוד, אין התחברות תקפה, או תקלה במסד = לא בעלים.
 * ה־layout של /admin בודק שוב (הגנה כפולה).
 */
export async function isAdminSessionToken(token: string | undefined): Promise<boolean> {
  if (!token || token.length > 200) return false;
  try {
    const allowed = getConfig().env.ADMIN_USERNAMES;
    if (parseAdminUsernames(allowed).size === 0) return false;
    getSessionSecret();
    const s = await validateSession(getDb(), token);
    return !!s && isAdminUsername(s.username, allowed);
  } catch (e) {
    logger.error("admin gate: check failed", { error: e });
    return false;
  }
}
