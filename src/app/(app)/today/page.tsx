import type { Metadata } from "next";
import { Cup } from "./Cup";
import { TodayBoard } from "./TodayBoard";
import type { DayTitles } from "./action-labels";
import { getConfig } from "@/config";
import { copy } from "@/content/copy.he";
import { DAYS } from "@/content/days";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/dal";
import { fill, withStartDate } from "@/lib/format";
import { timeTokens } from "@/lib/times";
import { serverNow } from "@/lib/today/clock";
import { dayOpening, dayTitles } from "@/lib/today/titles";
import { listCompletions } from "@/lib/today/completions";
import { getSchedule } from "@/lib/today/schedule";
import { getVideoConfig, hasVideo } from "@/lib/today/video";
import { actionKey, greetingKey, isMorning, nextBoundary, todayModel } from "@/lib/today/view";
import { stepsFor } from "@/lib/days";
import { getOfferModel } from "@/lib/offer/config";
import { OfferEntry } from "./OfferEntry";

export const metadata: Metadata = { title: `${copy.nav.today} | ${copy.brand.name}` };

export default async function TodayPage() {
  const user = await requireUser();
  const now = await serverNow();
  const schedule = getSchedule();
  const cfg = getConfig();
  const model = todayModel(now, schedule);

  if (model.phase === "before_start" || !schedule) {
    return (
      <>
        <section className="t t-hero" aria-labelledby="hero-h">
          <h1 id="hero-h">{withStartDate(copy.locked.beforeStartTitle, cfg.startDate)}</h1>
          <p>{fill(withStartDate(copy.locked.beforeStartBody, cfg.startDate), timeTokens())}</p>
        </section>
        <section className="t t-locked" aria-hidden="true">
          <Cup level="empty" width={96} height={115} />
        </section>
        <section className="t t-note">
          <p>{copy.locked.schedule}</p>
        </section>
      </>
    );
  }

  const rows = await listCompletions(getDb(), user.userId);
  const completions = rows.map((r) => actionKey(r.day, r.action));
  const day = model.day;
  const yesterday = model.yesterday;
  const yesterdayDone = yesterday ? stepsFor(yesterday, rows.filter((r) => r.day === yesterday).map((r) => r.action)) : 0;
  const tz = schedule.timeZone;

  let hero: string = copy.today.ended;
  if (day !== null) {
    hero = model.live
      ? copy.today.heroLive
      : fill(isMorning(now, tz) ? copy.today.heroMorning : copy.today.heroDay, { habit: DAYS[day - 1].habit.title });
  }
  const next = nextBoundary(now, schedule);
  // רק היום ואתמול: כותרות של ימים נעולים לא נשלחות ללקוח.
  const titles: Record<number, DayTitles> = {};
  for (const d of [day, yesterday]) if (d !== null) titles[d] = dayTitles(d);

  // יום 14 ואחריו: אריח קטן אל ההצעות (מצב ההצעה נקבע בשרת; בלי קישורים ובלי מחירים כאן).
  const offerEntry =
    day === 14 || model.phase === "ended" ? <OfferEntry offer={getOfferModel(now, schedule).offer} /> : null;

  return (
    <>
      <TodayBoard
        schedule={schedule}
        nowIso={now.toISOString()}
        completions={completions}
        phase={model.phase}
        day={day}
        live={model.live}
        yesterday={yesterday}
        showYesterday={yesterday !== null && yesterdayDone === 0}
        greeting={copy.today.greeting[greetingKey(now, tz)]}
        hero={hero}
        opening={day !== null ? dayOpening(day) : null}
        titles={titles}
        videoAvailable={day !== null && hasVideo(day, getVideoConfig(cfg.env))}
        nextChangeIso={next ? next.toISOString() : null}
      />
      {offerEntry}
    </>
  );
}
