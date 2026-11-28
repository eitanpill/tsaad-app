"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { copy } from "@/content/copy.he";
import { META_CONSENT_KEY, META_SCRIPT_URL, type MetaConsentMode } from "@/lib/meta/pixel";

type Choice = "granted" | "denied";
type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
};
type MetaWindow = Window & { fbq?: Fbq; _fbq?: Fbq };

const P = copy.landing.pixel;

function readChoice(): Choice | null {
  try {
    const v = window.localStorage.getItem(META_CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function saveChoice(v: Choice) {
  try {
    window.localStorage.setItem(META_CONSENT_KEY, v);
  } catch {
    // אחסון חסום: ההחלטה תקפה רק לביקור הזה.
  }
}

/**
 * הקוד הרשמי של מטא, בגרסת TypeScript: תור fbq, והסקריפט fbevents.js נטען כ־<script> שנוצר מהקוד שלנו
 * (מותר ב־CSP דרך 'strict-dynamic', בלי סקריפט inline). פעם אחת לחלון.
 * - disablePushState: בלי PageView אוטומטי במעבר בין דפים באפליקציה (הפיקסל מיועד לדף המכירה בלבד).
 * - autoConfig כבוי: מטא לא אוספת לבד טקסט של כפתורים ונתוני דף; נשלחים רק האירועים שמוגדרים כאן.
 */
function loadPixel(pixelId: string): Fbq {
  const w = window as MetaWindow;
  if (w.fbq) return w.fbq;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  fbq.disablePushState = true;
  w.fbq = fbq;
  if (!w._fbq) w._fbq = fbq;
  const s = document.createElement("script");
  s.async = true;
  s.src = META_SCRIPT_URL;
  document.head.appendChild(s);
  fbq("set", "autoConfig", false, pixelId);
  fbq("init", pixelId);
  return fbq;
}

/**
 * פיקסל מטא בדף המכירה: PageView בטעינה, ו־InitiateCheckout בלחיצה על כל כפתור הרשמה (הקישורים ל־/go/challenge, כולל הכפתור הצף).
 * הרכישה עצמה מתבצעת בדף התשלום החיצוני, ולכן אין כאן Purchase.
 * באנר קטן (לא חוסם, בלי מלכודת פוקוס) מודיע ומאפשר לסרב; ההחלטה נשמרת במכשיר. בלי JavaScript: אין פיקסל ואין באנר.
 */
export function MetaPixel({ pixelId, mode, value }: { pixelId: string; mode: MetaConsentMode; value: number }) {
  const [banner, setBanner] = useState(false);
  const fbqRef = useRef<Fbq | null>(null);
  const bannerRef = useRef<HTMLElement | null>(null);

  const start = useCallback(() => {
    if (fbqRef.current) return;
    const fbq = loadPixel(pixelId);
    fbq("consent", "grant");
    fbq("track", "PageView");
    fbqRef.current = fbq;
  }, [pixelId]);

  useEffect(() => {
    const choice = readChoice();
    if (choice === "granted" || (mode === "notice" && choice !== "denied")) start();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ההחלטה השמורה נקראת רק בדפדפן, אחרי ההידרציה
    setBanner(choice === null);

    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!a || !fbqRef.current) return;
      if (new URL((a as HTMLAnchorElement).href, location.href).pathname !== "/go/challenge") return;
      fbqRef.current("track", "InitiateCheckout", { value, currency: "ILS" });
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      // יציאה מדף המכירה בתוך האפליקציה: הפיקסל נשאר בזיכרון, אבל לא שולח יותר כלום.
      fbqRef.current?.("consent", "revoke");
      fbqRef.current = null;
    };
  }, [mode, start, value]);

  // בזמן שהבאנר פתוח הכפתור הצף מוסתר (שניהם בתחתית המסך ואסור שאחד יכסה את השני).
  useEffect(() => {
    const root = document.documentElement;
    if (banner) root.dataset.pixelBanner = "open";
    else delete root.dataset.pixelBanner;
    return () => {
      delete root.dataset.pixelBanner;
    };
  }, [banner]);

  const decide = (v: Choice) => {
    saveChoice(v);
    if (v === "granted") start();
    else {
      fbqRef.current?.("consent", "revoke");
      fbqRef.current = null;
    }
    // הפוקוס היה על כפתור שנעלם: מחזירים אותו לתוכן (2.4.3).
    if (bannerRef.current?.contains(document.activeElement)) {
      const main = document.getElementById("main");
      if (main) {
        main.tabIndex = -1;
        main.focus();
      }
    }
    setBanner(false);
  };

  if (!banner) return null;
  return (
    <section ref={bannerRef} className="pt-consent" aria-label={P.region} data-mode={mode}>
      <p>
        {mode === "optin" ? P.optin : P.notice}{" "}
        <Link href="/legal/privacy#p-pixel" className="plink">
          {P.more}
        </Link>
      </p>
      <div className="pt-consent-actions">
        <button type="button" className="pt-consent-btn pt-consent-btn--yes" onClick={() => decide("granted")}>
          {P.accept}
        </button>
        <button type="button" className="pt-consent-btn" onClick={() => decide("denied")}>
          {P.decline}
        </button>
      </div>
    </section>
  );
}
