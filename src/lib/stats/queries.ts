import "server-only";
import { sql } from "drizzle-orm";
import { CHALLENGE } from "@/config/constants";
import type { Db } from "@/db";
import { OFFER_KEYS } from "@/db/schema";
import { rowsOf } from "@/lib/auth/sql";

/**
 * מספרים מצטברים בלבד, בלי שמות ובלי מזהים: אין כאן שום שדה של אדם. הכל נגזר מהטבלאות הקיימות (users,
 * action_completions, push_subscriptions) ומהמונה offer_clicks.
 */
export type Stats = {
  signedUp: number;
  activated: number;
  /** מתוכם, כמה הופעלו ב־7 הימים האחרונים. */
  activatedLast7Days: number;
  /** לכל יום 1..14: כמה משתמשים סימנו בו לפחות פעולה אחת. */
  activePerDay: number[];
  /** לכל יום 1..14: מתוכם, כמה כבר סימנו גם ביום מוקדם יותר (חזרו). */
  returningPerDay: number[];
  /** distribution[k] = כמה משתמשים מופעלים עם k ימים שנספרו (0..14). */
  countedDistribution: number[];
  /** משתמשים שהגיעו ל־CHALLENGE.daysToComplete ימים נספרים ומעלה. */
  completed: number;
  remindersOptIn: number;
  /** לחיצות על כפתורי ההצעות, מצטבר ובשבעת הימים האחרונים. */
  offerClicks: Record<(typeof OFFER_KEYS)[number], { total: number; last7Days: number }>;
};

const n = (v: unknown) => Number(v ?? 0);

export async function getStats(db: Pick<Db, "execute">, timeZone: string): Promise<Stats> {
  const total = CHALLENGE.totalDays;
  const users = rowsOf<{ signed_up: number; activated: number; activated7: number }>(
    await db.execute(
      sql`select count(*)::int as signed_up, count(*) filter (where activated_at is not null)::int as activated,
                  count(*) filter (where activated_at > now() - interval '7 days')::int as activated7 from users`,
    ),
  )[0];

  const perDay = rowsOf<{ day: number; active: number; returning: number }>(
    await db.execute(
      sql`select c.day::int as day,
                 count(distinct c.user_id)::int as active,
                 count(distinct c.user_id) filter (
                   where exists (select 1 from action_completions p where p.user_id = c.user_id and p.day < c.day)
                 )::int as returning
            from action_completions c
           group by c.day`,
    ),
  );
  const activePerDay = Array.from({ length: total }, () => 0);
  const returningPerDay = Array.from({ length: total }, () => 0);
  for (const r of perDay) {
    if (r.day >= 1 && r.day <= total) {
      activePerDay[r.day - 1] = n(r.active);
      returningPerDay[r.day - 1] = n(r.returning);
    }
  }

  const dist = rowsOf<{ counted: number; users: number }>(
    await db.execute(
      sql`select coalesce(k.counted, 0)::int as counted, count(*)::int as users
            from users u
            left join (select user_id, count(distinct day)::int as counted from action_completions group by user_id) k
              on k.user_id = u.id
           where u.activated_at is not null
           group by 1`,
    ),
  );
  const countedDistribution = Array.from({ length: total + 1 }, () => 0);
  for (const r of dist) if (r.counted >= 0 && r.counted <= total) countedDistribution[r.counted] = n(r.users);
  const completed = countedDistribution.reduce((acc, v, k) => (k >= CHALLENGE.daysToComplete ? acc + v : acc), 0);

  const reminders = rowsOf<{ n: number }>(
    await db.execute(sql`select count(distinct user_id)::int as n from push_subscriptions`),
  )[0];

  const clicks = rowsOf<{ offer: string; total: number; last7: number }>(
    await db.execute(
      sql`select offer, sum(clicks)::int as total,
                 coalesce(sum(clicks) filter (where day > (now() at time zone ${timeZone})::date - 7), 0)::int as last7
            from offer_clicks group by offer`,
    ),
  );
  const offerClicks = Object.fromEntries(OFFER_KEYS.map((k) => [k, { total: 0, last7Days: 0 }])) as Stats["offerClicks"];
  for (const r of clicks) {
    if ((OFFER_KEYS as readonly string[]).includes(r.offer)) {
      offerClicks[r.offer as keyof Stats["offerClicks"]] = { total: n(r.total), last7Days: n(r.last7) };
    }
  }

  return {
    signedUp: n(users.signed_up),
    activated: n(users.activated),
    activatedLast7Days: n(users.activated7),
    activePerDay,
    returningPerDay,
    countedDistribution,
    completed,
    remindersOptIn: n(reminders.n),
    offerClicks,
  };
}
