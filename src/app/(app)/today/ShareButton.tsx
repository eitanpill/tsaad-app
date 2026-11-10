"use client";

import { useRef, useState } from "react";
import { copy } from "@/content/copy.he";

/**
 * "שתפו": מביא את תמונת הסיום (אותו origin, בלי מעקב) ומשתף אותה בעזרת Web Share API כשהדפדפן תומך בשיתוף קבצים;
 * אחרת התמונה יורדת כקובץ. הקישור "להורדת התמונה" תמיד זמין (גם בלי JavaScript). שום דבר לא גונב מיקוד,
 * והתוצאה מוכרזת באזור הסטטוס של הכפתור.
 */
export function ShareButton({ mask }: { mask: number }) {
  const url = `/api/share-card?m=${mask}`;
  const [busy, setBusy] = useState(false);
  const link = useRef<HTMLAnchorElement>(null);

  async function onShare() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) throw new Error("card");
      const file = new File([await res.blob()], "tsaad-14-days.png", { type: "image/png" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: copy.finish.shareText });
      } else {
        link.current?.click();
      }
    } catch (e) {
      // ביטול השיתוף על ידי המשתמש אינו שגיאה; כל כשל אחר: הורדה רגילה.
      if (!(e instanceof DOMException && e.name === "AbortError")) link.current?.click();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="share-row">
      <button type="button" className="btn-p" onClick={onShare} aria-busy={busy}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="M8.6 10.6 L15.4 6.4 M8.6 13.4 L15.4 17.6" />
        </svg>
        {copy.finish.share}
      </button>
      <a ref={link} className="link-s" href={url} download="tsaad-14-days.png">
        {copy.finish.download}
      </a>
    </div>
  );
}
