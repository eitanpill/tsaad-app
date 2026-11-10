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
  type LiveSession,
} from "@/lib/live/model";
import { serverNow } from "@/lib/today/clock";
import { listCompletions } from "@/lib/today/completions";
import { getSchedule } from "@/lib/today/schedule";
import { LiveIcon } from "../_components/icons";
import { RefreshAtBoundary } from "../_components/RefreshAtBoundary";
import { AttendanceToggle } from "./AttendanceToggle";

export const metadata: Metadata = { title: `${copy.nav.live} | ${copy.brand.name}` };

const textFor = (day: 7 | 14) => (day === 7 ? copy.live.day7 : copy.live.day14);

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
  const now = await serverNow();
  const schedule = getSchedule();
  const cfg = getConfig();
  const tz = cfg.timeZone;
  const sessions = liveSessions(now, schedule, getLiveInputs(cfg.env));
  const focus = focusSession(sessions);
  const other = sessions.find((s) => s !== focus)!;

  const liveMarks = schedule
    ? new Set((await listCompletions(getDb(), user.userId)).filter((c) => c.action === "live").map((c) => c.day))
    : new Set<number>();
  // סימון נוכחות: רק כשהשרת מאפשר סימון ליום הזה, ורק אחרי שהמפגש התחיל (כשיש שעה).
  const markable = (s: LiveSession) =>
    schedule !== null &&
    markState(s.day, now, schedule).ok &&
    (s.startsAt === null || now.getTime() >= s.startsAt.getTime());
  const attendance = (s: LiveSession) =>
    markable(s) ? (
      <AttendanceToggle key={`${s.day}-${liveMarks.has(s.day)}`} day={s.day} initial={liveMarks.has(s.day)} />
    ) : liveMarks.has(s.day) ? (
      <p className="lv-attend-done">{copy.live.attendedDone}</p>
    ) : null;

  const g = textFor(focus.day);
  const og = textFor(other.day);
  const calendarLink = (s: LiveSession) =>
    s.calendarAvailable ? (
      <a
        className="lv-cal"
        href={`/api/live/${s.day}/ics`}
        download
        aria-label={copy.a11y.live[s.day === 7 ? "addToCalendar7" : "addToCalendar14"]}
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
          aria-label={copy.a11y.live[s.day === 7 ? "addToCalendar7" : "addToCalendar14"]}
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

      <section className="t t-live-act" aria-label={fill(copy.common.dayLabel, { n: focus.day })}>
        {focus.state === "open" && focus.joinUrl ? (
          <a
            className="lv-join lv-join--on"
            href={focus.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={copy.a11y.live[focus.day === 7 ? "join7" : "join14"]}
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

      <section className="t t--half t-live-other" aria-labelledby="live-other-h">
        <span className="lv-tag-s">{og.tag}</span>
        <h2 id="live-other-h">{og.title}</h2>
        <span className="lv-other-when">
          {other.state === "passed" ? copy.live.ended : <When s={other} tz={tz} />}
        </span>
        {other.state !== "passed" ? calendarLink(other) : null}
        {attendance(other)}
      </section>

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
