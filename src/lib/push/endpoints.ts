/**
 * רשימת היתר לשירותי push ידועים. כתובת המנוי מגיעה מהדפדפן ולכן היא קלט לא אמין:
 * בלי בדיקה הייתה אפשרות לגרום לשרת לשלוח בקשות (SSRF) לכל כתובת.
 * בשימוש ב־api/push (שלב 9) בעת הרשמה, וגם בעת השליחה.
 */
const EXACT_HOSTS = new Set([
  "fcm.googleapis.com", // Chrome, Edge, Opera, Samsung
  "updates.push.services.mozilla.com", // Firefox
]);

/** סיומות (כולל נקודה מובילה) של תת־דומיינים מותרים. */
const HOST_SUFFIXES = [
  ".push.services.mozilla.com", // Firefox (אזורים)
  ".push.apple.com", // Safari / iOS (web.push.apple.com)
  ".notify.windows.com", // Windows (WNS)
];

export const MAX_ENDPOINT_LENGTH = 2048;

export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > MAX_ENDPOINT_LENGTH) {
    return false;
  }
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.username !== "" || u.password !== "") return false;
  if (u.port !== "") return false; // https בלבד על 443
  if (u.hash !== "") return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (EXACT_HOSTS.has(host)) return true;
  return HOST_SUFFIXES.some((s) => host.endsWith(s) && host.length > s.length);
}
