import { notFound } from "next/navigation";
import { getConfig } from "@/config";
import { CHALLENGE } from "@/config/constants";
import { OFFER_KEYS } from "@/db/schema";
import { copy } from "@/content/copy.he";
import { getDb } from "@/db";
import { verifySession } from "@/lib/auth/dal";
import { fill } from "@/lib/format";
import { isAdminUsername } from "@/lib/stats/admin";
import { getStats } from "@/lib/stats/queries";
import "./stats.css";

const A = copy.admin.stats;

const nf = new Intl.NumberFormat("he-IL");

/**
 * /admin/stats: מספרים מצטברים לבעלים, מרונדרים בשרת. רק משתמש מחובר ששם המשתמש שלו ב־ADMIN_USERNAMES;
 * כל השאר (גם בלי התחברות) מקבלים את דף ה־404 הרגיל, כך שהדף לא נחשף.
 */
export default async function StatsPage() {
  const cfg = getConfig();
  const user = await verifySession();
  if (!user || !isAdminUsername(user.username, cfg.env.ADMIN_USERNAMES)) notFound();
  const s = await getStats(getDb(), cfg.timeZone);

  return (
    <main className="adm" id="main">
      {/* בגוף הדף ולא ב־metadata: כותרת ה־metadata נשלחת גם למי שאינו מורשה ויכולה לחשוף שהדף קיים. React מעלה אותה ל־head. */}
      <title>{`${A.title} | ${copy.brand.name}`}</title>
      <h1>{A.title}</h1>
      <p className="adm-lead">{A.lead}</p>

      <section aria-labelledby="adm-sum-h">
        <h2 id="adm-sum-h">{A.summary.heading}</h2>
        <dl className="adm-cards">
          <Card label={A.summary.signedUp} value={s.signedUp} />
          <Card label={A.summary.activated} value={s.activated} />
          <Card label={A.summary.activatedLast7Days} value={s.activatedLast7Days} />
          <Card label={fill(A.summary.completed, { done: CHALLENGE.daysToComplete, total: CHALLENGE.totalDays })} value={s.completed} />
          <Card label={A.summary.remindersOptIn} value={s.remindersOptIn} />
        </dl>
      </section>

      <section aria-labelledby="adm-day-h">
        <h2 id="adm-day-h">{A.perDay.heading}</h2>
        <table>
          <caption>{A.perDay.caption}</caption>
          <thead>
            <tr>
              <th scope="col">{A.perDay.day}</th>
              <th scope="col">{A.perDay.active}</th>
              <th scope="col">{A.perDay.returning}</th>
            </tr>
          </thead>
          <tbody>
            {s.activePerDay.map((active, i) => (
              <tr key={i}>
                <th scope="row">{i + 1}</th>
                <td>{nf.format(active)}</td>
                <td>{nf.format(s.returningPerDay[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="adm-dist-h">
        <h2 id="adm-dist-h">{A.distribution.heading}</h2>
        <table>
          <caption>{A.distribution.caption}</caption>
          <thead>
            <tr>
              <th scope="col">{A.distribution.counted}</th>
              <th scope="col">{A.distribution.users}</th>
            </tr>
          </thead>
          <tbody>
            {s.countedDistribution.map((users, counted) => (
              <tr key={counted}>
                <th scope="row">{counted}</th>
                <td>{nf.format(users)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="adm-offer-h">
        <h2 id="adm-offer-h">{A.offers.heading}</h2>
        <table>
          <caption>{A.offers.caption}</caption>
          <thead>
            <tr>
              <th scope="col">{A.offers.offer}</th>
              <th scope="col">{A.offers.total}</th>
              <th scope="col">{A.offers.last7Days}</th>
            </tr>
          </thead>
          <tbody>
            {OFFER_KEYS.map((k) => (
              <tr key={k}>
                <th scope="row">{A.offers.names[k]}</th>
                <td>{nf.format(s.offerClicks[k].total)}</td>
                <td>{nf.format(s.offerClicks[k].last7Days)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="adm-note">{A.notes}</p>
    </main>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="adm-card">
      <dt>{label}</dt>
      <dd>{nf.format(value)}</dd>
    </div>
  );
}
