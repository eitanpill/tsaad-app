/**
 * פיקסל של מטא (Facebook/Instagram), בדף המכירה /tsaad בלבד. ללא server-only: משמש גם את proxy.ts (CSP) וגם את הרכיב בדפדפן.
 *
 * - המזהה מגיע מ־META_PIXEL_ID בסביבה (נקרא בשרת בכל בקשה). בלי מזהה תקין (ספרות בלבד): הפיקסל לא נטען וה־CSP לא משתנה.
 * - META_PIXEL_CONSENT: "notice" (ברירת מחדל) = הפיקסל נטען, ובאנר קטן מודיע ומאפשר לסרב (אז הפיקסל נעצר ולא נטען שוב);
 *   "optin" = הפיקסל לא נטען בכלל עד שלוחצים "אישור".
 */
export const META_PIXEL_ID_RE = /^\d{6,20}$/;

export type MetaConsentMode = "notice" | "optin";

/** מזהה תקין או null (כל ערך אחר נחשב כלא הוגדר). */
export function metaPixelId(raw: string | undefined | null): string | null {
  const v = raw?.trim();
  return v && META_PIXEL_ID_RE.test(v) ? v : null;
}

export function metaConsentMode(raw: string | undefined | null): MetaConsentMode {
  return raw?.trim() === "optin" ? "optin" : "notice";
}

/** הדפים שבהם הפיקסל רץ (וה־CSP נפתח למטא). רק דף המכירה, לא מסכי האפליקציה. */
export function isMetaPixelPath(pathname: string): boolean {
  return pathname === "/tsaad" || pathname === "/tsaad/";
}

/** מקורות מטא שהפיקסל צריך: הסקריפט (connect.facebook.net) ושליחת האירועים (www.facebook.com/tr, כתמונה או בבקשה). */
export const META_SCRIPT_ORIGIN = "https://connect.facebook.net";
export const META_EVENTS_ORIGIN = "https://www.facebook.com";
export const META_SCRIPT_URL = `${META_SCRIPT_ORIGIN}/en_US/fbevents.js`;

/** מפתח ההחלטה בדפדפן (localStorage, רק במכשיר הזה). */
export const META_CONSENT_KEY = "yogit-meta-consent";
