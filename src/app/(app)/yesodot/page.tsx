import type { Metadata } from "next";
import { copy } from "@/content/copy.he";
import { requireUser } from "@/lib/auth/dal";
import { getOfferModel } from "@/lib/offer/config";
import { goHref } from "@/lib/offer/links";
import { formatValidUntil } from "@/lib/offer/model";
import { serverNow } from "@/lib/today/clock";
import { getSchedule } from "@/lib/today/schedule";
import { RefreshAtBoundary } from "../_components/RefreshAtBoundary";
import { OfferCta } from "../offer/OfferCta";

export const metadata: Metadata = { title: `${copy.offer.yesodot.heading} | ${copy.brand.name}` };

/**
 * "יסודות היוגה": מסלול נפרד, פתוח לכל משתתף מחובר, עם תוקף משלו (YESODOT_OFFER_EXPIRY, שלא קשור לחלון ההצעה של יום 14).
 * בלי תוקף מוגדר: שורה ניטרלית (לא מציין המקום). אחרי התוקף: הודעה בלי כפתור.
 */
export default async function YesodotPage() {
  await requireUser();
  const now = await serverNow();
  const m = getOfferModel(now, getSchedule());
  const Y = copy.offer.yesodot;
  const v = m.yesodot;

  return (
    <>
      <RefreshAtBoundary atIso={v.kind === "valid" ? v.until.toISOString() : null} />
      <section className="t t-ofr-hero" aria-labelledby="yes-h">
        <h1 id="yes-h">{Y.heading}</h1>
        <p>{Y.lead}</p>
      </section>

      <div className="t t-ofr t-ofr--sage">
        {v.kind === "expired" ? (
          <p className="ofr-expired">{Y.expired}</p>
        ) : (
          <>
            <p className="ofr-price">{Y.price}</p>
            <p>{Y.priceNote}</p>
            <p className="ofr-note">
              {v.kind === "valid"
                ? Y.expiry.replace("[YESODOT_OFFER_EXPIRY]", formatValidUntil(m.yesodotRaw!, v.until, m.tz))
                : Y.expiryTba}
            </p>
            <OfferCta href={goHref("yesodot", m.links.yesodot)} label={Y.cta} noteId="yes-note" />
          </>
        )}
      </div>
    </>
  );
}
