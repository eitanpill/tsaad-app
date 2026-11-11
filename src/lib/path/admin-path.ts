/** דפי הבעלים (/admin ומה שתחתיו). בלי server-only: proxy.ts משתמש בזה. */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** שמות עוגיית ההתחברות (ראו lib/auth/config.ts: sessionCookieName). בדיקת קיום בלבד, לא אימות. */
export const SESSION_COOKIE_NAMES = ["__Host-tsaad_session", "tsaad_session"] as const;
