import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import type { getOfferModel } from "@/lib/offer/config";
import { goHref } from "@/lib/offer/links";
import { formatDeadline } from "@/lib/offer/model";
import { RefreshAtBoundary } from "../_components/RefreshAtBoundary";
import { OfferCta } from "./OfferCta";
import { YesodotTile } from "./YesodotTile";

type Model = ReturnType<typeof getOfferModel>;

/**
 * ההצעות של יום 14 כשחלון ההצעה פתוח (offer.state = "open"): אותם אריחים ואותם כללים בשני המקומות,
 * במסך /offer (כותרת h1) ובמסך הסיום של /today (כותרת h2, כי ה־h1 שם שייך לברכה).
 */
export function OfferTiles({ m, headingLevel }: { m: Model; headingLevel: 1 | 2 }) {
  const { offer } = m;
  if (offer.state !== "open") return null;
  const D = copy.offer.day14;
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <>
      <RefreshAtBoundary atIso={offer.nextChange.toISOString()} />
      <section className="t t-ofr-hero" aria-labelledby="ofr-h">
        <Heading id="ofr-h">{D.heading}</Heading>
        <p>{D.lead}</p>
        <p>{fill(D.window, { hours: offer.hours, deadline: formatDeadline(offer.deadline, m.tz) })}</p>
      </section>

      <section className="t t-ofr" aria-labelledby="ofr-session-h">
        <h2 id="ofr-session-h">{D.session.title}</h2>
        <p>{D.session.detail}</p>
        <p className="ofr-price">{D.session.price}</p>
        <p className="ofr-note">{D.session.scope}</p>
        {m.spots !== null ? <p className="ofr-spots">{fill(D.session.spots, { spots: m.spots })}</p> : null}
        <OfferCta href={goHref("session", m.links.session)} label={D.session.cta} ariaLabel={copy.a11y.offer.sessionCta} noteId="ofr-session-note" />
      </section>

      <section className="t t-ofr" aria-labelledby="ofr-bundle-h">
        <h2 id="ofr-bundle-h">{D.bundle.title}</h2>
        <p>{D.bundle.detail}</p>
        <p className="ofr-price">{D.bundle.price}</p>
        <OfferCta href={goHref("bundle", m.links.bundle)} label={D.bundle.cta} ariaLabel={copy.a11y.offer.bundleCta} noteId="ofr-bundle-note" />
      </section>

      <YesodotTile />
    </>
  );
}
