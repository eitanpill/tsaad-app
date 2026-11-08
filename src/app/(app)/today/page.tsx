import type { Metadata } from "next";
import { Cup } from "./Cup";
import { TodayBoard } from "./TodayBoard";
import { getConfig } from "@/config";
import { copy } from "@/content/copy.he";
import { DAYS } from "@/content/days";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/dal";
import { fill } from "@/lib/format";
import { serverNow } from "@/lib/today/clock";
import { listCompletions } from "@/lib/today/completions";
import { getSchedule } from "@/lib/today/schedule";
import { getVideoConfig, hasVideo } from "@/lib/today/video";
import { actionKey, greetingKey, isMorning, nextBoundary, todayModel } from "@/lib/today/view";
import { stepsFor } from "@/lib/days";

export const metadata: Metadata = { title: `${copy.nav.today} | ${copy.brand.name}` };

const HE_DATE = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", timeZone: "UTC" });

/** "[START_DATE]" מתמלא בתאריך מהתצורה; בלי תאריך מוגדר, המציין נשאר כלשונו (אין תאריך מומצא). */
function withStartDate(text: string, startDate: string | undefined): string {
  if (!startDate) return text;
  return text.replaceAll("[START_DATE]", HE_DATE.format(new Date(`${startDate}T00:00:00Z`)));
}

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
          <p>{withStartDate(copy.locked.beforeStartBody, cfg.startDate)}</p>
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

  return (
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
      videoAvailable={day !== null && hasVideo(day, getVideoConfig(cfg.env))}
      nextChangeIso={next ? next.toISOString() : null}
    />
  );
}
