import { getDb } from "@/db";
import { logger } from "@/lib/logger";
import { checkSubscription, subscribeSchema } from "@/lib/push/subscription";
import { guard, json } from "../guard";

/**
 * POST /api/push/status: האם המנוי של המכשיר הזה ({ endpoint, keys }) רשום למשתמש המחובר.
 * { registered: false } אומר ללקוח לבטל את המנוי המקומי (למשל מנוי שנשאר ממשתמש קודם באותו דפדפן).
 * POST ולא GET: הכתובת היא סוד ולא נכנסת ל־URL או ללוגים.
 */
export async function POST(req: Request) {
  const g = await guard(req, { rateLimit: false });
  if (g instanceof Response) return g;
  const parsed = subscribeSchema.safeParse(g.body);
  if (!parsed.success) return json({ registered: false }, 200);
  try {
    return json({ registered: await checkSubscription(getDb(), g.userId, parsed.data) }, 200);
  } catch (e) {
    logger.error("push status failed", { error: e });
    return json({ error: "failed" }, 500);
  }
}
