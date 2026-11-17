import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getConfig } from "@/config";
import { getSessionSecret, shouldUseSecureCookies } from "@/lib/auth/config";
import { verifySession } from "@/lib/auth/dal";
import type { Schedule } from "@/lib/days";
import { isAdminUsername } from "@/lib/stats/admin";
import { serverNow } from "@/lib/today/clock";
import { getSchedule } from "@/lib/today/schedule";
import { verifyPreviewCookie } from "./cookie";
import { previewSchedule } from "./schedule";

export const previewCookieName = () => (shouldUseSecureCookies() ? "__Host-tsaad_preview" : "tsaad_preview");

export function previewCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: shouldUseSecureCookies(), sameSite: "lax" as const, path: "/", maxAge };
}

/**
 * יום התצוגה המקדימה של הבקשה הזאת, או null. בכל בקשה: העוגייה חתומה ופגה לא, היא נחתמה על ידי המשתמש המחובר,
 * והמשתמש (עם סשן תקף שאינו מושבת) הוא מנהל ב־ADMIN_USERNAMES. כל כשל = אין תצוגה מקדימה, בלי שגיאה.
 * בלי עוגייה אין שאילתה בכלל.
 */
export const activePreviewDay = cache(async (): Promise<number | null> => {
  const raw = (await cookies()).get(previewCookieName())?.value;
  if (!raw) return null;
  try {
    const secret = getSessionSecret();
    const user = await verifySession();
    if (!user || !isAdminUsername(user.username, getConfig().env.ADMIN_USERNAMES)) return null;
    return verifyPreviewCookie(secret, user.userId, raw, Date.now());
  } catch {
    return null;
  }
});

export type AppClock = { now: Date; schedule: Schedule | null; previewDay: number | null };

/**
 * "עכשיו" והלוח של מסכי המשתמש. כרגיל: שעון השרת (serverNow, כולל הגנת שעון הבדיקות) ולוח START_DATE.
 * עם תצוגה מקדימה פעילה של מנהל: לוח וירטואלי שבו היום הוא יום N. שעון הבדיקות לא נוגעים בו.
 */
export async function getAppClock(): Promise<AppClock> {
  const now = await serverNow();
  const day = await activePreviewDay();
  if (day === null) return { now, schedule: getSchedule(), previewDay: null };
  const cfg = getConfig();
  return { now, schedule: previewSchedule(now, day, { timeZone: cfg.timeZone, unlockTime: cfg.unlockTime }), previewDay: day };
}
