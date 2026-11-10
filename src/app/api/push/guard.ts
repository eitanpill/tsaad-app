import "server-only";
import { PUSH } from "@/config/constants";
import { getDb } from "@/db";
import { getSessionSecret } from "@/lib/auth/config";
import { verifySession } from "@/lib/auth/dal";
import { rejectCrossOrigin } from "@/lib/auth/origin";
import { rateLimitKeys, registerAttempt } from "@/lib/auth/rate-limit";
import { logger } from "@/lib/logger";

export const NO_STORE = { "Cache-Control": "private, no-store" };
export const json = (body: unknown, status: number) => Response.json(body, { status, headers: NO_STORE });

/**
 * קריאה משותפת: Origin, סשן, מגבלת קצב לפי משתמש, גוף JSON קטן. מחזיר את המשתמש והגוף, או Response.
 * rateLimit: false רק לבדיקת המצב (api/push/status): היא נקראת בכל טעינה של האפליקציה, קוראת שורה אחת לפי
 * אינדקס ייחודי ולא כותבת (מלבד מחיקת מנוי של אותו מכשיר אצל משתמש אחר), ולכן לא נספרת מול התקרה של רישום/ביטול.
 * הסדר: Origin קודם (בקשה חוצת־אתרים לא מגיעה ל־DB), אחר כך הסשן, אחר כך מגבלת הקצב, ורק אז קריאת הגוף.
 */
export async function guard(
  req: Request,
  opts: { rateLimit?: boolean } = {},
): Promise<{ userId: string; body: unknown } | Response> {
  const cross = rejectCrossOrigin(req);
  if (cross) return cross;
  const session = await verifySession();
  if (!session) return json({ error: "unauthenticated" }, 401);

  if (opts.rateLimit !== false) {
    try {
      const limit = await registerAttempt(getDb(), "push", rateLimitKeys(getSessionSecret(), session.userId, null));
      if (!limit.allowed) {
        return Response.json(
          { error: "rate_limited" },
          { status: 429, headers: { ...NO_STORE, "Retry-After": String(limit.retryAfterSeconds) } },
        );
      }
    } catch (e) {
      logger.error("push rate limit failed", { error: e });
      return json({ error: "failed" }, 500);
    }
  }

  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return json({ error: "unsupported_media_type" }, 415);
  }
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > PUSH.maxBodyBytes) return json({ error: "too_large" }, 413);
  const text = await readCapped(req, PUSH.maxBodyBytes);
  if (text === null) return json({ error: "too_large" }, 413);
  try {
    return { userId: session.userId, body: JSON.parse(text) as unknown };
  } catch {
    return json({ error: "invalid" }, 400);
  }
}

/** קורא את הגוף ועוצר ברגע שעבר את התקרה (גם בלי Content-Length, למשל chunked). null = גדול מדי. */
async function readCapped(req: Request, max: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(all);
}
