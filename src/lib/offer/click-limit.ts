import { createHash } from "node:crypto";

/**
 * מתי לחיצה על /go/[offer] נספרת. ההפניה עצמה קורית תמיד; רק הספירה מסוננת, כדי שהמונה ישקף לחיצות של אנשים:
 * - בקשת prefetch/prerender של הדפדפן (Purpose, Sec-Purpose, Next-Router-Prefetch, X-Moz, X-Purpose) לא נספרת.
 * - סורקים ובוטים מוכרים (לפי User-Agent) לא נספרים. אין User-Agent = לא נספר.
 * - מגבלה קלה בזיכרון של המופע: לכל הצעה, לכל גיבוב IP, עד PER_IP לחיצות בחלון; ובלי IP אמין, תקרה כללית למופע.
 *   ה־IP לא נשמר בשום מקום: רק גיבוב SHA-256 שלו, בזיכרון, לזמן החלון. אין מסד, אין עוגייה.
 */

const PREFETCH_HEADERS = ["purpose", "sec-purpose", "x-purpose", "x-moz", "next-router-prefetch"] as const;
const BOT_UA = /bot|crawl|spider|slurp|preview|fetch|curl|wget|python|httpclient|headless|lighthouse|facebookexternalhit|whatsapp|telegram|monitor|scan/i;

type HeaderGetter = { get(name: string): string | null };

export function isPrefetchOrBot(headers: HeaderGetter): boolean {
  for (const h of PREFETCH_HEADERS) {
    const v = headers.get(h);
    if (v !== null && (h === "next-router-prefetch" || /prefetch|prerender|preview/i.test(v))) return true;
  }
  const ua = headers.get("user-agent");
  return !ua || BOT_UA.test(ua);
}

export type ClickLimits = { windowMs: number; perIp: number; perInstanceNoIp: number; maxKeys: number };
export const CLICK_LIMIT: Readonly<ClickLimits> = { windowMs: 10 * 60_000, perIp: 3, perInstanceNoIp: 120, maxKeys: 10_000 };

export class ClickLimiter {
  private hits = new Map<string, number[]>();
  constructor(private readonly limits: Readonly<ClickLimits> = CLICK_LIMIT) {}

  /** true = לספור את הלחיצה (ונרשמת); false = מעל המגבלה (ההפניה עדיין קורית). */
  allow(offer: string, ip: string | null, now: number = Date.now()): boolean {
    const key = ip ? `${offer}:${createHash("sha256").update(ip).digest("base64url")}` : `${offer}:*`;
    const max = ip ? this.limits.perIp : this.limits.perInstanceNoIp;
    const since = now - this.limits.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (list.length >= max) {
      this.hits.set(key, list);
      return false;
    }
    if (!this.hits.has(key) && this.hits.size >= this.limits.maxKeys) this.prune(since);
    list.push(now);
    this.hits.set(key, list);
    return true;
  }

  private prune(since: number) {
    for (const [k, v] of this.hits) if (!v.some((t) => t > since)) this.hits.delete(k);
    // עדיין מלא (הצפה מכתובות רבות): מתחילים מחדש. המחיר: אולי כמה לחיצות כפולות נספרות; הזיכרון נשאר חסום.
    if (this.hits.size >= this.limits.maxKeys) this.hits.clear();
  }
}
