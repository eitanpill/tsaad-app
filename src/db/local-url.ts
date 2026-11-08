/**
 * בדיקה אם מחרוזת חיבור ל־Postgres מצביעה רק למחשב המקומי (loopback).
 * בלי "server-only", כדי שגם סקריפטים (tsx) יוכלו לייבא.
 *
 * node-postgres (pg-connection-string) מאפשר לפרמטרי query כמו `?host=` לעקוף את
 * המארח שבכתובת, ולכן לא מספיק לבדוק את `URL.hostname`: כל פרמטר שמשנה יעד נדחה.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const PROTOCOLS = new Set(["postgres:", "postgresql:"]);
/** פרמטרים שמשנים לאן מתחברים (או טוענים קבצים/שירותים חיצוניים). */
const TARGET_PARAMS = new Set(["host", "hostaddr", "service", "servicefile", "socket"]);

export function isLocalDatabaseUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (!PROTOCOLS.has(u.protocol)) return false;
  if (!LOCAL_HOSTS.has(u.hostname.toLowerCase())) return false;
  for (const key of u.searchParams.keys()) {
    if (TARGET_PARAMS.has(key.toLowerCase())) return false;
  }
  return true;
}
