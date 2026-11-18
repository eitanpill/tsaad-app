/**
 * באיזה מכשיר ודפדפן המסך נפתח, כדי להציג במסך ההתקנה את ההוראות המתאימות ראשונות.
 * זה רק סדר תצוגה: כל ההוראות תמיד נשארות בדף, כך שטעות בזיהוי לא חוסמת אף אחד.
 */
export type InstallPlatform = "ios-safari" | "ios-other" | "android" | "desktop";

export function detectPlatform(ua: string, maxTouchPoints = 0): InstallPlatform {
  // iPadOS מציג את עצמו כ־Mac; מגע מסגיר אותו.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (ios) {
    // כרום, פיירפוקס, אדג' ודפדפנים בתוך אפליקציות (אינסטגרם, פייסבוק, גוגל ועוד) באייפון.
    const other = /CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV|Line\/|GSA\/|DuckDuckGo|YaBrowser/.test(ua);
    return other || !/Safari\//.test(ua) ? "ios-other" : "ios-safari";
  }
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export const ORDER: Record<InstallPlatform | "unknown", InstallPlatform[]> = {
  unknown: ["ios-safari", "ios-other", "android", "desktop"],
  "ios-safari": ["ios-safari", "ios-other", "android", "desktop"],
  "ios-other": ["ios-other", "ios-safari", "android", "desktop"],
  android: ["android", "ios-safari", "ios-other", "desktop"],
  desktop: ["desktop", "ios-safari", "ios-other", "android"],
};
