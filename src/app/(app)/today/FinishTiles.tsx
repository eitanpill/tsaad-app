import Link from "next/link";
import { SunDoodle } from "@/components/Doodles";
import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import type { FinishSummary } from "@/lib/path/finish";
import type { Stone } from "@/lib/path/view";
import { PathMap } from "../path/PathMap";
import { Ring } from "./Ring";
import { ShareButton } from "./ShareButton";

/**
 * סיום האתגר, בשני מקומות: ב־/today כשנספרו 12 ימים (ובימים 13 ו־14 עדיין פתוחים), ובמסך הסיום אחרי יום 14.
 * אריח החגיגה (רק כשהושלם) עם שיתוף וקישור להצעות כשהן פתוחות, ואחריו, במסך הסיום בלבד, הסיכום האישי; לבסוף כל השביל.
 * בלי מיקוד שנגנב: המסך נחגג באזור הסטטוס של הלוח.
 */
export function FinishTiles({
  completed,
  stones,
  summary,
  ended,
  offerOpen,
  pop,
}: {
  completed: boolean;
  stones: Stone[];
  summary: FinishSummary;
  ended: boolean;
  offerOpen: boolean;
  /** הושלם זה עתה (בזמן שהמסך פתוח): כניסה עם תנועה קצרה. */
  pop: boolean;
}) {
  const n = summary.countedDays.length;
  const F = copy.finish;
  return (
    <>
      {completed ? (
        <section className={`t t-finish${pop ? " t-finish--pop" : ""}`} aria-labelledby="fin-h">
          <div className="finish-head">
            <h2 id="fin-h">{copy.today.remaining.done}</h2>
            <SunDoodle className="finish-sun" size={72} />
          </div>
          <p>{fill(F.warm, { n })}</p>
          <ShareButton mask={summary.mask} />
          {offerOpen ? (
            <Link href="/offer" className="btn-s">
              {copy.offer.entry.cta}
            </Link>
          ) : null}
        </section>
      ) : null}

      {ended ? (
        <>
          <section className="t t-sum-days" aria-labelledby="sum-days-h">
            <Ring counted={n} size={64} />
            <div>
              <h2 id="sum-days-h">{F.countedDays}</h2>
              <p>{n > 0 ? summary.countedDays.join(", ") : fill(F.endedLine, { n })}</p>
            </div>
          </section>
          <section className="t t-sum-cups" aria-labelledby="sum-cups-h">
            <h2 id="sum-cups-h">{F.cups}</h2>
            <dl>
              <div>
                <dt>{copy.today.cup.three}</dt>
                <dd>{summary.cups.full}</dd>
              </div>
              <div>
                <dt>{copy.today.cup.two}</dt>
                <dd>{summary.cups.threeQuarters}</dd>
              </div>
              <div>
                <dt>{copy.today.cup.one}</dt>
                <dd>{summary.cups.half}</dd>
              </div>
            </dl>
          </section>
        </>
      ) : null}

      <PathMap stones={stones} counted={n} />
    </>
  );
}
