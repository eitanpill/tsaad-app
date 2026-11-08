import "server-only";

type HeaderGetter = { get(name: string): string | null };

/**
 * כתובת הלקוח להגבלת קצב. על Vercel הכותרות x-real-ip ו־x-forwarded-for נקבעות על ידי
 * הפלטפורמה ולא ניתנות לזיוף. מחוץ לפלטפורמה כזאת אין להסתמך עליהן (הגבלת ה־IP תהיה חלשה יותר).
 */
export function clientIp(headers: HeaderGetter): string | null {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd ? fwd.slice(0, 64) : null;
}
