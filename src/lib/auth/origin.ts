import "server-only";
import { getAppOrigin } from "./config";

type HeaderGetter = { get(name: string): string | null };

export class OriginError extends Error {
  constructor() {
    super("Cross-origin request rejected");
    this.name = "OriginError";
  }
}

/**
 * בדיקת Origin לבקשה שאינה GET. מחזיר true רק אם הבקשה מגיעה מה־origin של האפליקציה.
 * - Origin חייב להתאים בדיוק ל־APP_ORIGIN. בלי Origin, נבדק Referer. בלי שניהם: נדחה.
 * - Sec-Fetch-Site: cross-site נדחה גם אם שאר הכותרות נראות תקינות.
 * - בפיתוח בלי APP_ORIGIN: משווים ל־Host של הבקשה. בפרודקשן getAppOrigin זורק אם חסר.
 */
export function isSameOrigin(
  headers: HeaderGetter,
  appOrigin: string | undefined = getAppOrigin(),
): boolean {
  if (headers.get("sec-fetch-site") === "cross-site") return false;

  const expected =
    appOrigin ??
    (() => {
      const host = headers.get("host");
      return host ? `http://${host}` : undefined;
    })();
  if (!expected) return false;

  const origin = headers.get("origin");
  if (origin) return origin === expected;
  const referer = headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expected;
    } catch {
      return false;
    }
  }
  return false;
}

/** לשימוש ב־route handlers שאינם GET: מחזיר Response 403, או null אם הכול תקין. */
export function rejectCrossOrigin(request: Request): Response | null {
  return isSameOrigin(request.headers) ? null : new Response(null, { status: 403 });
}

/** לשימוש ב־server actions: זורק OriginError. */
export function assertSameOrigin(headers: HeaderGetter): void {
  if (!isSameOrigin(headers)) throw new OriginError();
}
