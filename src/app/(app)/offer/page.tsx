import type { Metadata } from "next";
import { copy } from "@/content/copy.he";
import { requireUser } from "@/lib/auth/dal";
import { fill } from "@/lib/format";
import { getOfferModel } from "@/lib/offer/config";
import { formatDeadline } from "@/lib/offer/model";
import { serverNow } from "@/lib/today/clock";
import { getSchedule } from "@/lib/today/schedule";
import { RefreshAtBoundary } from "../_components/RefreshAtBoundary";
import { OfferCta } from "./OfferCta";
import { YesodotTile } from "./YesodotTile";

export const metadata: Metadata = { title: `${copy.offer.day14.heading} | ${copy.brand.name}` };

/**
 * ההמשך אחרי 14 הימים. כל המצבים נקבעים בשרת לפי שעון השרת (lib/offer/model.ts), בלי ספירה לאחור:
 * notYet (לפני סוף הלייב ביום 14, או שחסר נתון בתצורה): אין קישורים ואין מחירים ב־HTML; open: הצעות עם מועד סיום; expired: הסתיימה.
 * "יסודות היוגה" נפרד, עם תוקף משלו (בדף /yesodot), ומוצג בשני המצבים האחרונים.
 */
export default async function OfferPage() {
  await requireUser();
  const now = await serverNow();
  const m = getOfferModel(now, getSchedule());
  const O = copy.offer;
  const { offer } = m;

  if (offer.state === "notYet") {
    return (
      <>
        <RefreshAtBoundary atIso={offer.nextChange?.toISOString() ?? null} />
        <section className="t t-ofr-hero" aria-labelledby="ofr-h">
          <h1 id="ofr-h">{O.notYet.heading}</h1>
          <p>{O.notYet.body}</p>
        </section>
      </>
    );
  }

  if (offer.state === "expired") {
    return (
      <>
        <section className="t t-ofr-hero" aria-labelledby="ofr-h">
          <h1 id="ofr-h">{O.day14.heading}</h1>
          <p className="ofr-expired">{O.day14.expired}</p>
        </section>
        <YesodotTile />
      </>
    );
  }

  const D = O.day14;
  return (
    <>
      <RefreshAtBoundary atIso={offer.nextChange.toISOString()} />
      <section className="t t-ofr-hero" aria-labelledby="ofr-h">
        <h1 id="ofr-h">{D.heading}</h1>
        <p>{D.lead}</p>
        <p>{fill(D.window, { hours: offer.hours, deadline: formatDeadline(offer.deadline, m.tz) })}</p>
      </section>

      <section className="t t-ofr" aria-labelledby="ofr-session-h">
        <h2 id="ofr-session-h">{D.session.title}</h2>
        <p>{D.session.detail}</p>
        <p className="ofr-price">{D.session.price}</p>
        <p className="ofr-note">{D.session.scope}</p>
        {m.spots !== null ? <p className="ofr-spots">{fill(D.session.spots, { spots: m.spots })}</p> : null}
        <OfferCta href={m.links.session} label={D.session.cta} ariaLabel={copy.a11y.offer.sessionCta} noteId="ofr-session-note" />
      </section>

      <section className="t t-ofr" aria-labelledby="ofr-bundle-h">
        <h2 id="ofr-bundle-h">{D.bundle.title}</h2>
        <p>{D.bundle.detail}</p>
        <p className="ofr-price">{D.bundle.price}</p>
        <OfferCta href={m.links.bundle} label={D.bundle.cta} ariaLabel={copy.a11y.offer.bundleCta} noteId="ofr-bundle-note" />
      </section>

      <YesodotTile />
    </>
  );
}
