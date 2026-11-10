import Link from "next/link";
import { copy } from "@/content/copy.he";
import type { OfferState } from "@/lib/offer/model";
import { RefreshAtBoundary } from "../_components/RefreshAtBoundary";

/** אריח קטן במסך היום, ביום 14 ואחרי: מוביל ל־/offer. הטקסט לפי מצב ההצעה בשרת. אין כאן מחירים וקישורי תשלום. */
export function OfferEntry({ offer }: { offer: OfferState }) {
  const O = copy.offer;
  const heading = offer.state === "notYet" ? O.notYet.heading : O.day14.heading;
  const body = offer.state === "notYet" ? O.notYet.body : offer.state === "open" ? O.day14.lead : O.day14.expired;
  return (
    <section className="t t-entry" aria-labelledby="offer-entry-h">
      <RefreshAtBoundary atIso={offer.nextChange?.toISOString() ?? null} />
      <h2 id="offer-entry-h">{heading}</h2>
      <p>{body}</p>
      <Link href="/offer">{O.entry.cta}</Link>
    </section>
  );
}
