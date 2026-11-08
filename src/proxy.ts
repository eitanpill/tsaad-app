import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, newNonce } from "@/lib/security/csp";

/**
 * Next 16: proxy.ts (לשעבר middleware). יוצר nonce לכל בקשה ומציב Content-Security-Policy.
 * הכותרת נקבעת גם על הבקשה (כדי ש־Next יקרא ממנה את ה־nonce בזמן הרינדור) וגם על התגובה.
 * הגנת הגישה עצמה נמצאת ב־DAL ובכל handler, לא כאן.
 */
export function proxy(request: NextRequest) {
  const nonce = newNonce();
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV === "development" });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // api/ ו־assets סטטיים אינם דפים. prefetch לא צריך nonce.
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
