import type { Metadata } from "next";
import { copy } from "@/content/copy.he";
import { requireUser } from "@/lib/auth/dal";
import { getOfferModel } from "@/lib/offer/config";
import { getAppClock } from "@/lib/preview/context";
import { RefreshAtBoundary } from "../_components/RefreshAtBoundary";
import { OfferTiles } from "./OfferTiles";
import { YesodotTile } from "./YesodotTile";

export const metadata: Metadata = { title: `${copy.offer.day14.heading} | ${copy.brand.name}` };

/**
 * ההמשך אחרי 14 הימים. כל המצבים נקבעים בשרת לפי שעון השרת (lib/offer/model.ts), בלי ספירה לאחור:
 * notYet (לפני סוף הלייב ביום 14, או שחסר נתון בתצורה): אין קישורים ואין מחירים ב־HTML; open: הצעות עם מועד סיום; expired: הסתיימה.
 * "יסודות היוגה" נפרד, עם תוקף משלו (בדף /yesodot), ומוצג בשני המצבים האחרונים.
 */
export default async function OfferPage() {
  await requireUser();
  const { now, schedule } = await getAppClock();
  const m = getOfferModel(now, schedule);
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

  return <OfferTiles m={m} headingLevel={1} />;
}
