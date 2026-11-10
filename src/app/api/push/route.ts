import { PUSH } from "@/config/constants";
import { getDb } from "@/db";
import { getSessionSecret } from "@/lib/auth/config";
import { verifySession } from "@/lib/auth/dal";
import { rejectCrossOrigin } from "@/lib/auth/origin";
import { rateLimitKeys, registerAttempt } from "@/lib/auth/rate-limit";
import { logger } from "@/lib/logger";
import { removeSubscription, saveSubscription, subscribeSchema, unsubscribeSchema } from "@/lib/push/subscription";

const NO_STORE = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status: number) => Response.json(body, { status, headers: NO_STORE });

/**
 * קריאה משותפת: Origin, סשן, מגבלת קצב לפי משתמש, גוף JSON קטן. מחזיר את המשתמש והגוף, או Response.
 * הסדר: Origin קודם (בקשה חוצת־אתרים לא מגיעה ל־DB), אחר כך הסשן, אחר כך מגבלת הקצב, ורק אז קריאת הגוף.
 */
async function guard(req: Request): Promise<{ userId: string; body: unknown } | Response> {
  const cross = rejectCrossOrigin(req);
  if (cross) return cross;
  const session = await verifySession();
  if (!session) return json({ error: "unauthenticated" }, 401);

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

  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return json({ error: "unsupported_media_type" }, 415);
  }
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > PUSH.maxBodyBytes) return json({ error: "too_large" }, 413);
  const text = await req.text();
  if (new TextEncoder().encode(text).length > PUSH.maxBodyBytes) return json({ error: "too_large" }, 413);
  try {
    return { userId: session.userId, body: JSON.parse(text) as unknown };
  } catch {
    return json({ error: "invalid" }, 400);
  }
}

/**
 * POST /api/push: רישום מנוי התראות של המכשיר הנוכחי. הגוף הוא PushSubscription.toJSON():
 * { endpoint, keys: { p256dh, auth } }. הכתובת חייבת להיות משירות push מוכר (lib/push/endpoints.ts).
 * עד REMINDERS.maxSubscriptionsPerUser מנויים למשתמש (הוותיק נמחק). ראו saveSubscription להעברת כתובת בין משתמשים.
 */
export async function POST(req: Request) {
  const g = await guard(req);
  if (g instanceof Response) return g;
  const parsed = subscribeSchema.safeParse(g.body);
  if (!parsed.success) return json({ error: "invalid" }, 400);
  try {
    const r = await saveSubscription(getDb(), g.userId, parsed.data);
    if (!r.ok) return json({ error: "conflict" }, 409);
    return json({ ok: true }, r.created ? 201 : 200);
  } catch (e) {
    logger.error("push subscribe failed", { error: e });
    return json({ error: "failed" }, 500);
  }
}

/** DELETE /api/push: מחיקת מנוי של המשתמש הנוכחי לפי endpoint. אידמפוטנטי (גם כשאין מה למחוק). */
export async function DELETE(req: Request) {
  const g = await guard(req);
  if (g instanceof Response) return g;
  const parsed = unsubscribeSchema.safeParse(g.body);
  if (!parsed.success) return json({ error: "invalid" }, 400);
  try {
    await removeSubscription(getDb(), g.userId, parsed.data.endpoint);
    return json({ ok: true }, 200);
  } catch (e) {
    logger.error("push unsubscribe failed", { error: e });
    return json({ error: "failed" }, 500);
  }
}
