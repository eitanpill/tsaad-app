"use client";

import { useEffect } from "react";
import { captureInstallPrompt } from "@/lib/pwa/install-prompt";

/**
 * רושם את ה־service worker (public/sw.js) ותופס את אירוע ההתקנה. לא מציג כלום.
 * ה־SW לא שומר HTML ולא נתונים אישיים (ראו sw.js), ולכן אין צורך לנקות אותו ביציאה.
 * רק בבילד של פרודקשן: בפיתוח SW מקשה על רענון חם.
 */
export function PwaBoot() {
  useEffect(() => {
    const stop = captureInstallPrompt();
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      const register = () =>
        navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }
    return stop;
  }, []);
  return null;
}
