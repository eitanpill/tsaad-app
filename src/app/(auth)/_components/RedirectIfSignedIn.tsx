import { redirect } from "next/navigation";
import { POST_LOGIN_PATH } from "@/lib/auth/config";
import { verifySession } from "@/lib/auth/dal";

/** קורא את העוגייה בזמן בקשה (מאחורי Suspense), ומפנה משתמש מחובר הלאה. */
export async function RedirectIfSignedIn() {
  if (await verifySession()) redirect(POST_LOGIN_PATH);
  return null;
}
