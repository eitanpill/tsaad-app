/**
 * Content-Security-Policy לכל בקשת דף. ה־nonce נוצר לכל בקשה ב־src/proxy.ts, ו־Next מוסיף אותו
 * בעצמו לסקריפטים ולסגנונות שהוא מייצר (ראו node_modules/next/dist/docs/.../content-security-policy.md).
 *
 * - script-src: אין 'unsafe-inline'. 'strict-dynamic' מאפשר לסקריפטים שנטענו מסקריפט עם nonce.
 *   'unsafe-eval' רק בפיתוח (React Refresh).
 * - style-src: nonce לתגיות <style>. style-src-attr מתיר 'unsafe-inline' רק לתכונות style="" (React style props,
 *   למשל הצבעים והאנימציות של הכוס). אין לכך השפעה על הרצת סקריפטים.
 * - report-uri / report-to: דיווחי הפרה ל־/api/csp-report (רישום מצומצם בלבד, בלי מסד).
 * - frame-src: נגן Bunny. כתובת ההטמעה שנחתמת ב־lib/bunny/token.ts היא iframe.mediadelivery.net בלבד,
 *   ולכן player.mediadelivery.net לא נוסף. מה שהנגן עצמו טוען נקבע ב־CSP של ה־iframe, לא כאן.
 */
export const BUNNY_EMBED_ORIGIN = "https://iframe.mediadelivery.net";

/** יעד דיווחי ההפרה (src/app/api/csp-report). report-uri לדפדפנים ישנים, report-to (עם Reporting-Endpoints ב־proxy) לחדשים. */
export const CSP_REPORT_PATH = "/api/csp-report";
export const CSP_REPORT_GROUP = "csp";

/** מארח CDN תקין של Bunny (אותו כלל כמו BUNNY_CDN_HOST ב־config/env.ts); כל דבר אחר לא נכנס ל־CSP. */
const CDN_HOST_RE = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*\.b-cdn\.net$/;

/**
 * @param opts.thumbHost מארח ה־CDN של Bunny (BUNNY_CDN_HOST), רק לתמונות הממוזערות של הסרטונים: נוסף ל־img-src ולא לשום הנחיה אחרת.
 */
export function buildCsp(nonce: string, opts: { dev?: boolean; thumbHost?: string } = {}): string {
  const dev = opts.dev ?? false;
  const thumb = opts.thumbHost && CDN_HOST_RE.test(opts.thumbHost) ? ` https://${opts.thumbHost}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob:${thumb}`,
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "media-src 'self' blob:",
    // רישום ה־service worker (/sw.js) וה־manifest. worker-src מפורש: עם 'strict-dynamic' ב־script-src, 'self' לא נספר שם.
    "worker-src 'self'",
    "manifest-src 'self'",
    `frame-src ${BUNNY_EMBED_ORIGIN}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_REPORT_GROUP}`,
  ].join("; ");
}

/** CSP קשיחה לתגובות שאינן דפים (route handlers): אין מה לטעון בהן. */
export const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
