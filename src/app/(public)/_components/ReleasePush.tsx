"use client";

import { useEffect } from "react";
import { releaseSubscriptionForLogout } from "@/lib/pwa/push-client";

/** אחרי מחיקת חשבון: מבטל את מנוי ההתראות של הדפדפן הזה (השורה בשרת כבר נמחקה). לא זורק ולא מציג כלום. */
export function ReleasePush() {
  useEffect(() => {
    void releaseSubscriptionForLogout();
  }, []);
  return null;
}
