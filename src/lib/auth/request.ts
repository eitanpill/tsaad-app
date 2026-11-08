import "server-only";

type HeaderGetter = { get(name: string): string | null };
type Env = Record<string, string | undefined>;

/**
 * האם לסמוך על כותרות ה־IP של הבקשה. על Vercel (VERCEL=1) הפלטפורמה קובעת את x-real-ip
 * ו־x-forwarded-for ודורסת ערכים שהלקוח שלח. בכל אירוח אחר הלקוח יכול לזייף אותן, ולכן
 * סומכים עליהן רק כשמוגדר במפורש TRUST_PROXY_IP_HEADERS=true (מאחורי proxy שדורס אותן).
 */
export function trustsProxyIpHeaders(env: Env = process.env): boolean {
  return env.VERCEL === "1" || env.TRUST_PROXY_IP_HEADERS === "true";
}

/**
 * כתובת הלקוח להגבלת קצב, או null כשאין מקור אמין. בלי IP, נשארת המגבלה לפי מזהה (ולפי חשבון);
 * רק המגבלה לפי IP לא פועלת. עדיף כך מאשר מפתח שהתוקף בוחר בעצמו.
 */
export function clientIp(headers: HeaderGetter, env: Env = process.env): string | null {
  if (!trustsProxyIpHeaders(env)) return null;
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd ? fwd.slice(0, 64) : null;
}
