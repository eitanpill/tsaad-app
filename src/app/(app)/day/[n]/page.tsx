import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getConfig } from "@/config";
import { copy } from "@/content/copy.he";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/dal";
import { actionsForDay, stepsFor, type Action } from "@/lib/days";
import { fill } from "@/lib/format";
import { dayScreen, parseDayParam } from "@/lib/path/view";
import { serverNow } from "@/lib/today/clock";
import { dayOpening, dayTitles } from "@/lib/today/titles";
import { listDayCompletions } from "@/lib/today/completions";
import { getSchedule } from "@/lib/today/schedule";
import { getVideoConfig, hasVideo } from "@/lib/today/video";
import { nextBoundary, todayModel } from "@/lib/today/view";
import { CheckIcon } from "../../_components/icons";
import { RefreshAtBoundary } from "../../_components/RefreshAtBoundary";
import { TYPE_LABEL, actionDetail, actionTitle } from "../../today/action-labels";
import { VideoTile } from "../../today/VideoTile";
import { DayActions } from "./DayActions";
import { LockedDay } from "./LockedDay";

type Props = { params: Promise<{ n: string }> };

/** הכותרת לא תלויה במצב הנעילה: רק "יום N" (בלי תוכן). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const day = parseDayParam((await params).n);
  return { title: `${day ? fill(copy.common.dayLabel, { n: day }) : copy.nav.path} | ${copy.brand.name}` };
}

/**
 * מסך יום. כל ההחלטות לפי שעון השרת (dayScreen):
 *  - n שאינו 1 עד 14 (או לא מספר שלם): 404.
 *  - היום הנוכחי: הפניה ל־/today (שם הלוח המלא, כדי שלא יהיו שני מסכי סימון ליום אחד).
 *  - יום שנפתח (אתמול עד חצות, או ישן יותר): תוכן. אתמול ניתן לסימון; ישן יותר לצפייה בלבד ("לא נספר" אם לא סומן).
 *  - יום נעול: המסך הנעול בלבד. לא נקראים כאן תוכן היום, כותרות הפעולות או מזהה הסרטון.
 */
export default async function DayPage({ params }: Props) {
  const n = parseDayParam((await params).n);
  if (n === null) notFound();
  const user = await requireUser();
  const now = await serverNow();
  const schedule = getSchedule();
  const cfg = getConfig();

  // הסימונים של היום הזה בלבד; לימים נעולים אין סימונים ממילא.
  const doneRaw = schedule ? await listDayCompletions(getDb(), user.userId, n) : [];
  const done: Action[] = doneRaw.filter((a) => actionsForDay(n).includes(a));
  const screen = dayScreen(n, now, schedule, stepsFor(n, done));

  if (screen.kind === "today") redirect("/today");

  const next = schedule ? nextBoundary(now, schedule) : null;
  const refresh = <RefreshAtBoundary atIso={next ? next.toISOString() : null} />;

  if (screen.kind === "locked") {
    return (
      <>
        {refresh}
        <LockedDay
          day={n}
          reason={screen.reason}
          previousDay={screen.reason === "tomorrow" ? todayModel(now, schedule).yesterday : null}
          startDate={cfg.startDate}
        />
      </>
    );
  }

  // יום פתוח (לא הנוכחי): התוכן שלו.
  const titles = dayTitles(n);
  const stateText = screen.markable ? copy.path.stone.yesterday : screen.counted ? copy.path.stone.counted : copy.path.stone.missed;
  const available = hasVideo(n, getVideoConfig(cfg.env));
  return (
    <>
      {refresh}
      <section className="t t-hero" aria-labelledby="day-h">
        <span className="eyebrow-s">{stateText}</span>
        <h1 id="day-h">{fill(copy.common.dayLabel, { n })}</h1>
        <p className="opening">{dayOpening(n)}</p>
      </section>

      <VideoTile day={n} available={available} title={fill(copy.day.videoTitle, { n })} />

      <section className="t t-actions" aria-labelledby="day-actions-h">
        <h2 id="day-actions-h" className="act-title">
          {fill(copy.today.yesterdayDayLabel, { n })}
        </h2>
        {screen.markable ? (
          <DayActions day={n} titles={titles} done={done} />
        ) : (
          <>
            <ul className="ro-list">
              {actionsForDay(n).map((a) => {
                const marked = done.includes(a);
                return (
                  <li key={a} className="ro-item" data-marked={marked}>
                    <b>{TYPE_LABEL(a)}</b>
                    <span>
                      {actionTitle(titles, a)}
                      {actionDetail(titles, a) ? <small className="act-detail">{actionDetail(titles, a)}</small> : null}
                    </span>
                    <span className="ro-state">
                      {marked ? <CheckIcon size={14} /> : null}
                      {marked ? copy.a11y.action.pressedHint : copy.day.notMarked}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="act-hint">{fill(screen.counted ? copy.day.closedCounted : copy.day.closedMissed, { n })}</p>
          </>
        )}
      </section>

      <section className="t t-links">
        <Link href="/path" className="btn-s">
          {copy.day.toPath}
        </Link>
        <Link href="/today" className="btn-s">
          {copy.locked.backToToday}
        </Link>
      </section>
    </>
  );
}
