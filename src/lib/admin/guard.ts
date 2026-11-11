import "server-only";
import { headers } from "next/headers";
import { getConfig } from "@/config";
import { getDb } from "@/db";
import { getSessionSecret, RATE_LIMITS } from "@/lib/auth/config";
import { verifySession } from "@/lib/auth/dal";
import { OriginError, assertSameOrigin } from "@/lib/auth/origin";
import { rateLimitKeys, registerAttempt } from "@/lib/auth/rate-limit";
import { isAdminUsername } from "@/lib/stats/admin";
import { logger } from "@/lib/logger";

export type AdminActor = { userId: string; username: string };
export type GateError = "forbidden" | "tooMany" | "generic";

/**
 * שער משותף לכל פעולת שרת של הבעלים: Origin, סשן תקף (לא מושבת), שם המשתמש ב־ADMIN_USERNAMES (נבדק שוב בשרת, לא סומכים על
 * העמוד שהציג את הטופס), ומגבלת קצב לפי מנהל. כשל סגור: כל שגיאה = דחייה.
 */
export async function adminGate(opts: { rateLimit?: boolean } = {}): Promise<{ ok: true; actor: AdminActor } | { ok: false; error: GateError }> {
  try {
    assertSameOrigin(await headers());
  } catch (e) {
    if (e instanceof OriginError) return { ok: false, error: "forbidden" };
    logger.error("admin gate: origin check failed", { error: e });
    return { ok: false, error: "generic" };
  }
  try {
    const user = await verifySession();
    if (!user || !isAdminUsername(user.username, getConfig().env.ADMIN_USERNAMES)) return { ok: false, error: "forbidden" };
    if (opts.rateLimit !== false) {
      const r = await registerAttempt(getDb(), "account", rateLimitKeys(getSessionSecret(), `admin:${user.userId}`, null), RATE_LIMITS.adminActions);
      if (!r.allowed) {
        logger.warn("admin action rate limited", { actorId: user.userId });
        return { ok: false, error: "tooMany" };
      }
    }
    return { ok: true, actor: { userId: user.userId, username: user.username } };
  } catch (e) {
    logger.error("admin gate failed", { error: e });
    return { ok: false, error: "generic" };
  }
}
