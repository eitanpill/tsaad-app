import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getConfig } from "@/config";
import { verifySession } from "@/lib/auth/dal";
import { isAdminUsername } from "@/lib/stats/admin";

/**
 * מעטפת דפי הבעלים. לא נסרקים ולא מאונדקסים. ההרשאה נבדקת כאן, ב־layout (ולא רק בדף): כך ה־404 נקבע לפני שהתגובה
 * מתחילה להישלח ומקבל סטטוס 404 אמיתי (notFound() בתוך הדף מגיע אחרי שהמעטפת נשלחה, והסטטוס נשאר 200).
 * רק משתמש מחובר ששם המשתמש שלו ב־ADMIN_USERNAMES; כל השאר, גם בלי התחברות, מקבלים את דף ה־404 הרגיל.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await verifySession();
  if (!user || !isAdminUsername(user.username, getConfig().env.ADMIN_USERNAMES)) notFound();
  return <>{children}</>;
}
