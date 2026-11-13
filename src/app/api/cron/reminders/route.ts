import { getConfig } from "@/config";
import { getDb } from "@/db";
import { isCronAuthorized, jsonNoStore, unauthorized } from "@/lib/cron/auth";
import { logger } from "@/lib/logger";
import { drainGhlOutbox, getGhl } from "@/lib/ghl/link-delivery";
import { getPushSender, runLiveReminders, runReminders } from "@/lib/push";
import { serverNow } from "@/lib/today/clock";

/** Vercel Cron: GET עם Authorization: Bearer CRON_SECRET. מחזיר ספירות בלבד. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return unauthorized();
  try {
    const config = getConfig();
    const sender = getPushSender(config.env.REMINDERS_ENABLED, config.env);
    // serverNow: the real time, except under the test-clock guard (never on Vercel), so e2e can run a dry-run day.
    const now = await serverNow();
    const ghl = getGhl();
    const result = await runReminders({ db: getDb(), config, sender, now, ghlConfig: ghl.cfg });
    // תזכורת הלייב (נפרדת מהיומית, ביום לייב בלבד, כשעה לפני המפגש): אותה ריצה של 15 דקות. כשל בה לא מפיל את היומית.
    let live;
    try {
      live = await runLiveReminders({ db: getDb(), config, sender, now, ghlConfig: ghl.cfg });
    } catch (e) {
      logger.error("live reminders failed", { error: e });
    }
    // תזכורות ה־GHL שנכנסו ל־outbox נשלחות מיד (בלי לחכות לריצת ה־sync); כשלים זמניים ינוסו שוב שם.
    const drain = ghl.cfg.reminderMode === "live" ? await drainGhlOutbox(getDb(), now) : undefined;
    return jsonNoStore({ ...result, ...(live ? { live } : {}), ...(drain ? { ghlSend: drain } : {}) });
  } catch (e) {
    logger.error("cron reminders failed", { error: e });
    return jsonNoStore({ error: "failed" }, 500);
  }
}
