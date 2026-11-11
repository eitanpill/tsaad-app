import type { Metadata } from "next";
import { getConfig } from "@/config";
import { copy } from "@/content/copy.he";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/dal";
import { getGhl } from "@/lib/ghl/link-delivery";
import { getWhatsappReminderPref } from "@/lib/ghl/preferences";
import { fill } from "@/lib/format";
import { timeTokens } from "@/lib/times";
import { RemindersControls } from "./RemindersControls";
import { WhatsappToggle } from "./WhatsappToggle";

export const metadata: Metadata = { title: `${copy.nav.reminders} | ${copy.brand.name}` };

/**
 * תזכורות. מפתח ה־VAPID הציבורי מגיע כ־prop מהשרת (לא NEXT_PUBLIC): בלי מפתח המסך במצב "לא נתמך" והמתג כבוי.
 * המפתח הפרטי לא נוגע בדף הזה.
 */
export default async function RemindersPage() {
  const user = await requireUser();
  // מתג הוואטסאפ: רק כשתזכורת ה־GHL אינה כבויה, ורק למי שיש לו איש קשר ב־GHL (אחרים לא מקבלים וואטסאפ בכלל).
  const whatsapp =
    getGhl().cfg.reminderMode === "off" ? null : await getWhatsappReminderPref(getDb(), user.userId);
  const vapidKey = getConfig().env.VAPID_PUBLIC_KEY ?? null;
  const times = timeTokens();
  const previewText = fill(copy.push.generic, { day: copy.push.previewDay });

  return (
    <>
      <section className="t t-rem-hero" aria-labelledby="rem-h">
        <h1 id="rem-h">{copy.reminders.title}</h1>
        <p>{fill(copy.reminders.intro, times)}</p>
      </section>

      <section className="t t-rem-preview" aria-label={fill(copy.a11y.reminders.preview, { text: previewText })}>
        <span className="rm-eyebrow" aria-hidden="true">
          {copy.reminders.previewLabel}
        </span>
        <div className="rm-notif" aria-hidden="true">
          <span className="rm-notif-icon">
            <svg width="22" height="26" viewBox="0 0 40 48" focusable="false">
              <path d="M5 4 L35 4 L31 44 L9 44 Z" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinejoin="round" />
              <path d="M8 26 Q14 22 20 26 T32 26 L31 44 L9 44 Z" fill="#FFFFFF" />
            </svg>
          </span>
          <span className="rm-notif-text">
            <b>{copy.push.title}</b>
            <br />
            {previewText}
          </span>
        </div>
      </section>

      <RemindersControls vapidKey={vapidKey} unlockTime={times.unlockTime} reminderTime={times.reminderTime} />
      {whatsapp?.hasContact ? <WhatsappToggle initial={whatsapp.on} /> : null}
    </>
  );
}
