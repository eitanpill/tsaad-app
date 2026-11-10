import { UTM } from "@/config/constants";

/** ללא server-only. כתובת https תקינה, או null. כל ערך אחר (כולל מציין מקום בסוגריים מרובעים) = אין קישור. */
export function safeHttpsUrl(raw: string | undefined | null): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

/**
 * קישור יציאה להצעה עם פרמטרי UTM. מוסיף utm_source ו־utm_medium (UTM), ו־utm_campaign כשהוגדר.
 * לא דורס פרמטר utm שכבר קיים בכתובת שהוגדרה, ושומר את שאר הפרמטרים. מחזיר null כשאין כתובת https תקינה:
 * הכפתור יוצג כלא פעיל.
 */
export function offerLink(raw: string | undefined, campaign: string | undefined): string | null {
  const u = safeHttpsUrl(raw);
  if (!u) return null;
  const set = (k: string, v: string | undefined) => {
    if (v && !u.searchParams.has(k)) u.searchParams.set(k, v);
  };
  set("utm_source", UTM.source);
  set("utm_medium", UTM.medium);
  set("utm_campaign", campaign);
  return u.toString();
}
