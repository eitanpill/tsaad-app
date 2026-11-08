import "server-only";
import { createHash } from "node:crypto";

/**
 * Bunny Stream: embed view token authentication.
 * נוסחה לפי התיעוד של Bunny (bunny.net/docs/stream/token-authentication):
 *   token = SHA256_HEX(token_security_key + video_id + expiration)
 * שרשור ישיר בלי מפרידים, פלט hex, ו־expiration הוא UNIX בשניות.
 * הכתובת מקבלת את הפרמטרים token ו־expires.
 */
export const DEFAULT_EMBED_TTL_SECONDS = 60 * 60;
const EMBED_HOST = "https://iframe.mediadelivery.net";

export function bunnyEmbedToken(args: {
  tokenKey: string;
  videoId: string;
  expires: number;
}): string {
  if (!args.tokenKey) throw new Error("missing Bunny token key");
  if (!Number.isInteger(args.expires) || args.expires <= 0) {
    throw new RangeError("expires must be a UNIX timestamp in whole seconds");
  }
  return createHash("sha256")
    .update(args.tokenKey + args.videoId + String(args.expires), "utf8")
    .digest("hex");
}

export function buildBunnyEmbedUrl(args: {
  libraryId: string;
  videoId: string;
  tokenKey: string;
  now: Date;
  ttlSeconds?: number;
}): { url: string; expires: number } {
  const ttl = args.ttlSeconds ?? DEFAULT_EMBED_TTL_SECONDS;
  if (!Number.isInteger(ttl) || ttl <= 0) throw new RangeError("ttlSeconds must be a positive integer");
  // מזהים מגיעים מהתצורה/תוכן, אך מוודאים שאין בהם תווים שישברו את הנתיב.
  if (!/^[A-Za-z0-9_-]+$/.test(args.libraryId)) throw new RangeError("bad library id");
  if (!/^[A-Za-z0-9_-]+$/.test(args.videoId)) throw new RangeError("bad video id");
  const expires = Math.floor(args.now.getTime() / 1000) + ttl;
  const token = bunnyEmbedToken({ tokenKey: args.tokenKey, videoId: args.videoId, expires });
  return {
    url: `${EMBED_HOST}/embed/${args.libraryId}/${args.videoId}?token=${token}&expires=${expires}`,
    expires,
  };
}
