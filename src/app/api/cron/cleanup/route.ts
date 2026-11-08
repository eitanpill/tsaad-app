import { getDb } from "@/db";
import { isCronAuthorized, jsonNoStore, unauthorized } from "@/lib/cron/auth";
import { logger } from "@/lib/logger";
import { runCleanup } from "@/lib/maintenance/cleanup";

/** Vercel Cron (יומי): GET עם Authorization: Bearer CRON_SECRET. מחזיר ספירות בלבד. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return unauthorized();
  try {
    return jsonNoStore(await runCleanup(getDb()));
  } catch (e) {
    logger.error("cron cleanup failed", { error: e });
    return jsonNoStore({ error: "failed" }, 500);
  }
}
