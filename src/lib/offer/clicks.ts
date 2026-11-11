import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { OFFER_KEYS } from "@/db/schema";

export type OfferKey = (typeof OFFER_KEYS)[number];

export function isOfferKey(v: unknown): v is OfferKey {
  return typeof v === "string" && (OFFER_KEYS as readonly string[]).includes(v);
}

/**
 * סופר לחיצה אחת על כפתור הצעה: מונה לפי הצעה ולפי יום מקומי (בשעון המסד), בלי שום מידע על מי לחץ.
 * עדכון אטומי אחד (upsert), כך שלחיצות מקבילות לא הולכות לאיבוד.
 */
export async function recordOfferClick(db: Pick<Db, "execute">, offer: OfferKey, timeZone: string): Promise<void> {
  await db.execute(
    sql`insert into offer_clicks (offer, day, clicks)
        values (${offer}, (now() at time zone ${timeZone})::date, 1)
        on conflict (offer, day) do update set clicks = offer_clicks.clicks + 1`,
  );
}
