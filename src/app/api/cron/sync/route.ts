import { getConfig } from "@/config";
import { getDb } from "@/db";
import { isCronAuthorized, jsonNoStore, unauthorized } from "@/lib/cron/auth";
import { logger } from "@/lib/logger";
import { drainGhlOutbox, getGhl } from "@/lib/ghl/link-delivery";
import { serverNow } from "@/lib/today/clock";
import { getSyncAdapter, runSyncWorker } from "@/lib/sync";

/** Vercel Cron: GET עם Authorization: Bearer CRON_SECRET. מחזיר ספירות בלבד. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return unauthorized();
  try {
    const config = getConfig();
    const enabled = config.env.TRACKER_SYNC_ENABLED === true;
    const ghl = getGhl().cfg;
    const ghlLive = ghl.reminderMode === "live" || ghl.deliveryMode === "live";
    // הכל כבוי: לא פותחים אפילו חיבור למסד.
    if (!enabled && !ghlLive) return jsonNoStore({ enabled: false, claimed: 0, sent: 0, failed: 0, dead: 0 });
    const result = await runSyncWorker({ db: getDb(), enabled, adapter: getSyncAdapter() });
    // ניסיונות חוזרים של שליחות GHL (תזכורות וקישורים) שנכשלו זמנית.
    const ghlSend = ghlLive ? await drainGhlOutbox(getDb(), await serverNow()) : undefined;
    return jsonNoStore(ghlSend ? { ...result, ghlSend } : result);
  } catch (e) {
    logger.error("cron sync failed", { error: e });
    return jsonNoStore({ error: "failed" }, 500);
  }
}
