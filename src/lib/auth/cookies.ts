import "server-only";
import { cookies } from "next/headers";
import { sessionCookieName, shouldUseSecureCookies } from "./config";

/** HttpOnly, Secure (חוץ מ־localhost בפיתוח), SameSite=Lax, Path=/, בלי Domain (נדרש ל־__Host-). */
export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName())?.value;
}

export async function setSessionCookie(token: string, expires: Date): Promise<void> {
  (await cookies()).set(sessionCookieName(), token, sessionCookieOptions(expires));
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(sessionCookieName(), "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
}
