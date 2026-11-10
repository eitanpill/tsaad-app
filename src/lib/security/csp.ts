/**
 * Content-Security-Policy לכל בקשת דף. ה־nonce נוצר לכל בקשה ב־src/proxy.ts, ו־Next מוסיף אותו
 * בעצמו לסקריפטים ולסגנונות שהוא מייצר (ראו node_modules/next/dist/docs/.../content-security-policy.md).
 *
 * - script-src: אין 'unsafe-inline'. 'strict-dynamic' מאפשר לסקריפטים שנטענו מסקריפט עם nonce.
 *   'unsafe-eval' רק בפיתוח (React Refresh).
 * - style-src: nonce לתגיות <style>. style-src-attr מתיר 'unsafe-inline' רק לתכונות style="" (React style props,
 *   למשל הצבעים והאנימציות של הכוס). אין לכך השפעה על הרצת סקריפטים.
 * - frame-src: נגן Bunny. כתובת ההטמעה שנחתמת ב־lib/bunny/token.ts היא iframe.mediadelivery.net בלבד,
 *   ולכן player.mediadelivery.net לא נוסף. מה שהנגן עצמו טוען נקבע ב־CSP של ה־iframe, לא כאן.
 */
export const BUNNY_EMBED_ORIGIN = "https://iframe.mediadelivery.net";

export function buildCsp(nonce: string, opts: { dev?: boolean } = {}): string {
  const dev = opts.dev ?? false;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
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
