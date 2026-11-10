"use client";

import { useEffect } from "react";
import { pushSupported, reconcileSubscription } from "@/lib/pwa/push-client";

/**
 * רושם את ה־service worker (public/sw.js), ומתאם את מנוי ההתראות של הדפדפן למשתמש המחובר: מנוי שנשאר ממשתמש
 * קודם באותו דפדפן מבוטל (reconcileSubscription). לא מציג כלום. אירוע ההתקנה נתפס מוקדם יותר (components/PwaEarly).
 * ה־SW לא שומר HTML ולא נתונים אישיים (ראו sw.js), ולכן אין צורך לנקות אותו ביציאה.
 * רישום ה־SW רק בבילד של פרודקשן: בפיתוח SW מקשה על רענון חם.
 */
export function PwaBoot() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      const register = () =>
        navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }
    if (pushSupported() && Notification.permission === "granted") void reconcileSubscription().catch(() => undefined);
  }, []);
  return null;
}
