import type { Metadata } from "next";
import { getConfig } from "@/config";
import { copy } from "@/content/copy.he";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/dal";
import { markState } from "@/lib/days";
import { fill } from "@/lib/format";
import { getLiveInputs } from "@/lib/live/config";
import {
  focusSession,
  liveSessions,
  liveWhen,
  nextLiveChange,
  type LiveDay,
  type LiveSession,
} from "@/lib/live/model";
import { getAppClock } from "@/lib/preview/context";
import { listCompletions } from "@/lib/today/completions";
import { LiveIcon } from "../_components/icons";
import { RefreshAtBoundary } from "../_components/RefreshAtBoundary";
import { AttendanceToggle } from "./AttendanceToggle";

export const metadata: Metadata = { title: `${copy.nav.live} | ${copy.brand.name}` };

const textFor = (day: LiveDay) => (day === 0 ? copy.live.day0 : day === 7 ? copy.live.day7 : copy.live.day14);
const calLabel = (day: LiveDay) =>
  day === 0 ? copy.a11y.live.addToCalendar0 : day === 7 ? copy.a11y.live.addToCalendar7 : copy.a11y.live.addToCalendar14;
const joinLabel = (day: LiveDay) => (day === 0 ? copy.a11y.live.join0 : day === 7 ? copy.a11y.live.join7 : copy.a11y.live.join14);

/**
 * שעה (ותאריך כשידוע) כ־<time>. כשאין שעה מוגדרת לא ממציאים אחת, ולא מציגים למשתתפים את מציין המקום
 * (copy.live.dayN.time, "[LIVE_DAYn_TIME]"): מוצג copy.live.timeTba.
 */
function When({ s, tz }: { s: LiveSession; tz: string }) {
  const w = liveWhen(s, tz);
  if (!w) return <span className="lv-tba">{copy.live.timeTba}</span>;
  return (
    <time dateTime={w.datetime ?? w.time}>
      {w.date ? `${w.date}, ` : null}
      <span dir="ltr">{w.time}</span>
    </time>
  );
}

export default async function LivePage() {
  const user = await requireUser();
  const { now, schedule } = await getAppClock();
  const cfg = getConfig();
  const tz = cfg.timeZone;
  const sessions = liveSessions(now, schedule, getLiveInputs(cfg.env));
  const focus = focusSession(sessions);
  const others = sessions.filter((s) => s !== focus);

  const liveMarks = schedule
    ? new Set((await listCompletions(getDb(), user.userId)).filter((c) => c.action === "live").map((c) => c.day))
    : new Set<number>();
  // סימון נוכחות: רק כשהשרת מאפשר סימון ליום הזה, ורק אחרי שהמפגש התחיל (כשיש שעה).
  // מפגש הפתיחה (יום 0) אינו יום באתגר: אין לו סימון נוכחות, והוא לא נספר בכוס.
  const markable = (s: LiveSession) =>
    s.day !== 0 &&
    schedule !== null &&
    markState(s.day, now, schedule).ok &&
    (s.startsAt === null || now.getTime() >= s.startsAt.getTime());
  const attendance = (s: LiveSession) =>
    markable(s) && s.day !== 0 ? (
      <AttendanceToggle key={`${s.day}-${liveMarks.has(s.day)}`} day={s.day} initial={liveMarks.has(s.day)} />
    ) : liveMarks.has(s.day) ? (
      <p className="lv-attend-done">{copy.live.attendedDone}</p>
    ) : null;

  const g = textFor(focus.day);
  const calendarLink = (s: LiveSession) =>
    s.calendarAvailable ? (
      <a
        className="lv-cal"
        href={`/api/live/${s.day}/ics`}
        download
        aria-label={calLabel(s.day)}
      >
        {copy.live.addToCalendar}
      </a>
    ) : (
      <>
        <button
          type="button"
          className="lv-cal lv-cal--off"
          aria-disabled="true"
          aria-describedby={`cal-note-${s.day}`}
          aria-label={calLabel(s.day)}
        >
          {copy.live.addToCalendar}
        </button>
        <span id={`cal-note-${s.day}`} className="lv-note">
          {copy.live.calendarUnavailable}
        </span>
      </>
    );

  return (
    <>
      <RefreshAtBoundary atIso={nextLiveChange(sessions)?.toISOString() ?? null} />

      <section className="t t-live-hero" aria-labelledby="live-h">
        <span className="lv-tag">
          <i className="lv-dot" aria-hidden="true" />
          {g.tag}
        </span>
        <h1 id="live-h">{g.title}</h1>
        <p className="lv-when">
          <When s={focus} tz={tz} />
        </p>
      </section>

      <section className="t t-live-act" aria-label={focus.day === 0 ? copy.live.day0.tag : fill(copy.common.dayLabel, { n: focus.day })}>
        {focus.state === "open" && focus.joinUrl ? (
          <a
            className="lv-join lv-join--on"
            href={focus.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={joinLabel(focus.day)}
            aria-describedby="live-reg"
          >
            <LiveIcon />
            {copy.live.join}
          </a>
        ) : focus.state === "passed" ? (
          <p className="lv-join lv-join--off">{copy.live.ended}</p>
        ) : (
          <button
            type="button"
            className="lv-join lv-join--off"
            aria-disabled="true"
            aria-describedby="live-reg"
          >
            <LiveIcon />
            {focus.state === "open" ? copy.live.linkMissing : copy.live.linkOpensLater}
          </button>
        )}
        {focus.state !== "passed" ? calendarLink(focus) : null}
        {attendance(focus)}
        <span id="live-reg" className="lv-note">
          {copy.live.linkRegisteredOnly}
        </span>
      </section>

      {/* Every session, in order (opening, day 7, day 14). The tiles below carry the actions of the sessions that are not in focus. */}
      <section className="t t-live-all" aria-labelledby="live-all-h">
        <h2 id="live-all-h">{copy.live.allHeading}</h2>
        <ol className="lv-all" aria-label={copy.live.allLabel}>
          {sessions.map((s) => (
            <li key={s.day} aria-current={s === focus ? "step" : undefined} data-day={s.day}>
              <span className="lv-all-tag">{textFor(s.day).tag}</span>
              <b>{textFor(s.day).title}</b>
              <When s={s} tz={tz} />
              <span className="lv-all-state">
                {s.state === "passed" ? copy.live.stateEnded : s.state === "open" ? copy.live.stateOpen : copy.live.stateUpcoming}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {others.map((o) => {
        const att = attendance(o);
        const cal = o.state !== "passed" && o.calendarAvailable;
        if (!att && !cal) return null;
        return (
          <section key={o.day} className="t t--half t-live-other" aria-labelledby={`live-other-h-${o.day}`} data-day={o.day}>
            <span className="lv-tag-s">{textFor(o.day).tag}</span>
            <h2 id={`live-other-h-${o.day}`}>{textFor(o.day).title}</h2>
            {/* Compact tile: only a working calendar link and the attendance mark. The list above already says the time (or that it is to be announced). */}
            {cal ? calendarLink(o) : null}
            {att}
          </section>
        );
      })}

      <section className="t t--half t-live-cant" aria-labelledby="live-cant-h">
        <h2 id="live-cant-h">{copy.live.cantAttend}</h2>
        <span>{copy.live.cantAttendBody}</span>
      </section>

      <p className="visually-hidden" role="status" aria-live="polite">
        {focus.state === "open" && focus.joinUrl ? copy.a11y.live.joinOpened : ""}
      </p>
    </>
  );
}
