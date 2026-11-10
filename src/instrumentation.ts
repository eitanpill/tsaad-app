/**
 * רץ פעם אחת כשמופע שרת עולה (לא בזמן build). בפרודקשן: בדיקת הסביבה (src/config/required.ts).
 * משתנה חובה חסר או ערך לא תקין מפילים את העלייה עם הודעה שמפרטת שמות בלבד, במקום שגיאות מפוזרות בכל בקשה.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { checkProductionEnv } = await import("./config/required");
  const warnings = checkProductionEnv(process.env);
  if (warnings.length) {
    const { logger } = await import("./lib/logger");
    for (const w of warnings) logger.warn(`env: ${w}`);
  }
}
