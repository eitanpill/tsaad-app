import { getConfig } from "@/config";
import { getDb } from "@/db";
import { clientIp } from "@/lib/auth/request";
import { logger } from "@/lib/logger";
import { ClickLimiter, isPrefetchOrBot } from "@/lib/offer/click-limit";
import { isOfferKey, recordOfferClick, type OfferKey } from "@/lib/offer/clicks";
import { getOfferLinks } from "@/lib/offer/config";

const NO_STORE = { "Cache-Control": "no-store" };
const limiter = new ClickLimiter();

/** היעד: רק מרשימה סגורה של ארבע הצעות ומהמשתנים MORNING_URL_*; שום חלק מהבקשה לא משפיע עליו (אין open redirect). */
async function target(ctx: { params: Promise<{ offer: string }> }): Promise<{ offer: OfferKey; url: string } | null> {
  const { offer } = await ctx.params;
  if (!isOfferKey(offer)) return null;
  const url = getOfferLinks(getConfig().env)[offer];
  return url ? { offer, url } : null;
}

const notFound = () => new Response("Not found", { status: 404, headers: NO_STORE });
const redirectTo = (url: string) => new Response(null, { status: 302, headers: { Location: url, ...NO_STORE, "Referrer-Policy": "no-referrer" } });

/**
 * GET /go/[offer]: מפנה (302) לכתובת ה־https שהוגדרה, וסופר לחיצה (מונה מצטבר, בלי מידע אישי).
 * לא נספרות: בקשות prefetch/prerender, בוטים, ומעבר למגבלה הקלה לכל גיבוב IP (lib/offer/click-limit.ts). ההפניה קורית בכל מקרה.
 * הצעה לא מוכרת או בלי כתובת = 404. כשל בספירה לא עוצר את ההפניה.
 */
export async function GET(req: Request, ctx: { params: Promise<{ offer: string }> }) {
  const t = await target(ctx);
  if (!t) return notFound();
  if (!isPrefetchOrBot(req.headers) && limiter.allow(t.offer, clientIp(req.headers))) {
    try {
      await recordOfferClick(getDb(), t.offer, getConfig().timeZone);
    } catch (e) {
      logger.error("offer click count failed", { offer: t.offer, error: e });
    }
  }
  return redirectTo(t.url);
}

/** HEAD: אותה תשובה, בלי ספירה (בודקי קישורים ותצוגות מקדימות). */
export async function HEAD(_req: Request, ctx: { params: Promise<{ offer: string }> }) {
  const t = await target(ctx);
  return t ? redirectTo(t.url) : notFound();
}
