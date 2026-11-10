import { getDb } from "@/db";
import { logger } from "@/lib/logger";
import { removeSubscription, saveSubscription, subscribeSchema, unsubscribeSchema } from "@/lib/push/subscription";
import { guard, json } from "./guard";

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
