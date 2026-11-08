import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { logger } from "@/lib/logger";
import { AuthConfigError, getSessionSecret } from "./config";
import { readSessionToken } from "./cookies";
import { validateSession } from "./session";

export type CurrentUser = { userId: string; username: string; displayName: string };

/**
 * שכבת הגישה לנתונים: הבדיקה היחידה שדפים ו־handlers סומכים עליה (לא רק proxy.ts).
 * נשמרת בזיכרון לפי בקשה (React cache), ולכן אפשר לקרוא לה מכל רכיב בלי שאילתות כפולות.
 * בפרודקשן, בלי SESSION_SECRET תקין, אף אחד לא מזוהה (fail closed).
 */
export const verifySession = cache(async (): Promise<CurrentUser | null> => {
  // קודם העוגייה (קריאת בקשה, שמוציאה את הרכיב מהרינדור הסטטי), ורק אחר כך בדיקת התצורה.
  const token = await readSessionToken();
  try {
    getSessionSecret();
  } catch (e) {
    if (e instanceof AuthConfigError) {
      logger.error("auth disabled: configuration invalid", { error: e });
      return null;
    }
    throw e;
  }
  if (!token) return null;
  const s = await validateSession(getDb(), token);
  return s ? { userId: s.userId, username: s.username, displayName: s.displayName } : null;
});

/** מחזיר את המשתמש המחובר, או מפנה ל־/login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await verifySession();
  if (!user) redirect("/login");
  return user;
}
