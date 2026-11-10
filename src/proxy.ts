import { NextResponse, type NextRequest } from "next/server";
import { isAdminPath, SESSION_COOKIE_NAMES } from "@/lib/path/admin-path";
import { isInvalidDayPath } from "@/lib/path/day-param";
import { CSP_REPORT_GROUP, CSP_REPORT_PATH, buildCsp, newNonce } from "@/lib/security/csp";

/** נתיב שאין לו דף: שכתוב אליו נותן את דף ה־404 של האפליקציה (src/app/not-found.tsx) עם סטטוס 404 אמיתי. */
const NOT_FOUND_PATH = "/__not-found";

/**
 * Next 16: proxy.ts (לשעבר middleware). יוצר nonce לכל בקשה ומציב Content-Security-Policy.
 * הכותרת נקבעת גם על הבקשה (כדי ש־Next יקרא ממנה את ה־nonce בזמן הרינדור) וגם על התגובה.
 * הגנת הגישה עצמה נמצאת ב־DAL ובכל handler, לא כאן.
 *
 * /day/<לא יום תקין> (0, 15, 07, abc...) מקבל כאן 404 אמיתי: בדף עצמו notFound() מגיע אחרי שהמעטפת
 * כבר נשלחה (Suspense), ולכן שם הסטטוס נשאר 200. הבדיקה לא תלויה במשתמש או בשעה, רק בצורת הכתובת.
 */
export function proxy(request: NextRequest) {
  const nonce = newNonce();
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV === "development" });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  // דפי הבעלים בלי עוגיית התחברות בכלל: 404 אמיתי כבר כאן (בדף עצמו notFound() מגיע אחרי שהמעטפת נשלחה, והסטטוס נשאר 200).
  // מי שיש לו עוגייה נבדק ב־layout של /admin (ADMIN_USERNAMES) ומקבל את אותו דף 404.
  const hiddenAdmin = isAdminPath(request.nextUrl.pathname) && !SESSION_COOKIE_NAMES.some((n) => request.cookies.has(n));
  const response = isInvalidDayPath(request.nextUrl.pathname) || hiddenAdmin
    ? NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url), { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  // report-to: הקבוצה "csp" שב־CSP מצביעה לכאן (כתובת מלאה באותו origin).
  response.headers.set("Reporting-Endpoints", `${CSP_REPORT_GROUP}="${request.nextUrl.origin}${CSP_REPORT_PATH}"`);
  return response;
}

export const config = {
  matcher: [
    {
      // api/ ו־assets סטטיים אינם דפים. prefetch לא צריך nonce. ("api/" עם הלוכסן: דף כמו /apiary מקבל CSP.)
      // גם הקבצים הסטטיים של ה־PWA (sw.js, manifest, offline, אייקונים) לא עוברים כאן: ל־CSP שלהם יש כותרות קבועות ב־next.config.ts.
      source:
        "/((?!api/|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline.html|offline.css|apple-touch-icon.png|icons/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
