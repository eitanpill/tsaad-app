import { getConfig } from "@/config";
import { getDb } from "@/db";
import { isCronAuthorized, jsonNoStore, unauthorized } from "@/lib/cron/auth";
import { logger } from "@/lib/logger";
import { getPushSender, runReminders } from "@/lib/push";

/** Vercel Cron: GET עם Authorization: Bearer CRON_SECRET. מחזיר ספירות בלבד. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return unauthorized();
  try {
    const config = getConfig();
    const sender = getPushSender(config.env.REMINDERS_ENABLED, config.env);
    const result = await runReminders({ db: getDb(), config, sender });
    return jsonNoStore(result);
  } catch (e) {
    logger.error("cron reminders failed", { error: e });
    return jsonNoStore({ error: "failed" }, 500);
  }
}
