import { getConfig } from "@/config";
import { getDb } from "@/db";
import { logger } from "@/lib/logger";
import { isOfferKey, recordOfferClick } from "@/lib/offer/clicks";
import { getOfferLinks } from "@/lib/offer/config";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET /go/[offer]: סופר לחיצה על כפתור הצעה (מונה מצטבר, בלי מידע אישי) ומפנה (302) לכתובת ה־https שהוגדרה בסביבה.
 * היעד נקבע רק מרשימה סגורה של ארבע הצעות ומהמשתנים MORNING_URL_*; שום חלק מהבקשה לא משפיע עליו (אין פרמטר יעד,
 * אין open redirect). הצעה לא מוכרת או שאין לה כתובת מוגדרת = 404. כשל בספירה לא עוצר את ההפניה.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ offer: string }> }) {
  const { offer } = await ctx.params;
  if (!isOfferKey(offer)) return new Response("Not found", { status: 404, headers: NO_STORE });
  const cfg = getConfig();
  const target = getOfferLinks(cfg.env)[offer];
  if (!target) return new Response("Not found", { status: 404, headers: NO_STORE });
  try {
    await recordOfferClick(getDb(), offer, cfg.timeZone);
  } catch (e) {
    logger.error("offer click count failed", { offer, error: e });
  }
  return new Response(null, { status: 302, headers: { Location: target, ...NO_STORE, "Referrer-Policy": "no-referrer" } });
}
