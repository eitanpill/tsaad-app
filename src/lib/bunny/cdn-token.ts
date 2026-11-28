import "server-only";
import { createHash } from "node:crypto";

/**
 * Bunny CDN (Pull Zone): Token Authentication, הגרסה הבסיסית.
 * לפי התיעוד של Bunny (support.bunny.net, "How to sign URLs for BunnyCDN Token Authentication"):
 *   token = Base64Url(SHA256_RAW(security_key + url_path + expires)), בלי '='.
 * הכתובת מקבלת את הפרמטרים token ו־expires.
 */
export const DEFAULT_CDN_TTL_SECONDS = 2 * 60 * 60;

export function bunnyCdnToken(args: { tokenKey: string; path: string; expires: number }): string {
  if (!args.tokenKey) throw new Error("missing Bunny CDN token key");
  if (!Number.isInteger(args.expires) || args.expires <= 0) throw new RangeError("expires must be whole UNIX seconds");
  return createHash("sha256")
    .update(args.tokenKey + args.path + String(args.expires), "utf8")
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** כתובת https לקובץ ב־Pull Zone. עם מפתח: חתומה ל־ttl שניות. בלי מפתח: כתובת רגילה. */
export function buildBunnyCdnUrl(args: { host: string; file: string; tokenKey?: string; now: Date; ttlSeconds?: number }): string {
  if (!/^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*\.b-cdn\.net$/.test(args.host)) throw new RangeError("bad CDN host");
  if (!/^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)*$/.test(args.file) || args.file.includes("..")) throw new RangeError("bad file path");
  const path = "/" + args.file;
  const base = `https://${args.host}${path}`;
  if (!args.tokenKey) return base;
  const expires = Math.floor(args.now.getTime() / 1000) + (args.ttlSeconds ?? DEFAULT_CDN_TTL_SECONDS);
  return `${base}?token=${bunnyCdnToken({ tokenKey: args.tokenKey, path, expires })}&expires=${expires}`;
}
