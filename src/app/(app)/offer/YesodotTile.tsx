import Link from "next/link";
import { copy } from "@/content/copy.he";

/** תקציר "יסודות היוגה" בתוך מסך ההצעות: נפרד מחלון ההצעה של יום 14, עם הקישור לדף המלא (שם התוקף שלו). */
export function YesodotTile() {
  const Y = copy.offer.yesodot;
  return (
    <section className="t t-ofr t-ofr--sage" aria-labelledby="ofr-yes-h">
      <h2 id="ofr-yes-h">{Y.heading}</h2>
      <p>{Y.lead}</p>
      <p className="ofr-price">{Y.price}</p>
      <Link className="ofr-cta" href="/yesodot">
        {Y.more}
      </Link>
    </section>
  );
}
