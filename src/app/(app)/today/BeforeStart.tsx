import Link from "next/link";
import { WithRoundPhoto } from "@/components/AvitalPhoto";
import { SprigDoodle, SunDoodle } from "@/components/Doodles";
import { copy } from "@/content/copy.he";
import { fill, withStartDate } from "@/lib/format";
import { liveWhen, type LiveSession } from "@/lib/live/model";
import { timeTokens } from "@/lib/times";
import { CupIcon } from "../_components/icons";
import { LiveIcon } from "../_components/icons";
import { RefreshAtBoundary } from "../_components/RefreshAtBoundary";

const base = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" } as const;
const WaveIcon = () => (
  <svg {...base}><path d="M2.5 14.5 C 6 6.5, 10 6.5, 12 12 S 18 18.5, 21.5 9.5" /><circle cx="19" cy="5" r="1.4" fill="currentColor" stroke="none" /></svg>
);
const BreathIcon = () => (
  <svg {...base}><circle cx="12" cy="12" r="3" /><path d="M6.5 12 A5.5 5.5 0 0 1 12 6.5" /><path d="M17.5 12 A5.5 5.5 0 0 1 12 17.5" /><path d="M3.5 12 A8.5 8.5 0 0 1 12 3.5" /></svg>
);

/**
 * מסך קבלת הפנים לפני תאריך ההתחלה: כמה ימים נשארו (רק כש־START_DATE מוגדר), מה מחכה בכל יום (שלוש הפעולות),
 * והזמנה להפעיל תזכורות ולהוסיף למסך הבית. בלי סרטון עד שיהיה אחד, ובלי ספירה מומצאת.
 * daysUntil: ימי לוח מהיום (שעון ישראל) עד תאריך ההתחלה; null כשאין תאריך.
 */
export function BeforeStart({
  startDate,
  daysUntil,
  nextChangeIso,
  opening,
  openingIsToday,
  timeZone,
}: {
  startDate: string | undefined;
  daysUntil: number | null;
  nextChangeIso: string | null;
  /** מפגש הפתיחה (יום 0), כפי שהשרת חישב אותו ברגע הזה. הקישור קיים בו רק בחלון הקישור. */
  opening: LiveSession;
  /** היום הקלנדרי הוא יום המפגש: הכרטיס מודגש ועולה מיד אחרי הכותרת. */
  openingIsToday: boolean;
  timeZone: string;
}) {
  const B = copy.before;
  const times = timeTokens();
  const count =
    daysUntil === null ? null : daysUntil <= 0 ? (
      <b className="bs-word">{B.today}</b>
    ) : daysUntil === 1 ? (
      <b className="bs-word">{B.tomorrow}</b>
    ) : (
      <>
        <b className="bs-num">{daysUntil}</b>
        <span>{B.days}</span>
      </>
    );
  const L = copy.live;
  const w = liveWhen(opening, timeZone);
  const showCard = opening.state !== "passed" || openingIsToday;
  const liveCard = showCard ? (
    <section
      className={`t t-live-open ar-live${openingIsToday ? " t-live-open--today" : ""}`}
      aria-labelledby="open-live-h"
      data-testid="opening-live"
    >
      <WithRoundPhoto
        slot="live"
        tag={
        <span className="lv-tag">
          <i className="lv-dot" aria-hidden="true" />
          {openingIsToday ? B.live.todayTag : L.day0.tag}
        </span>
        }
      />
      <h2 id="open-live-h">{L.day0.title}</h2>
      <p className="lv-when">
        {w ? (
          <time dateTime={w.datetime ?? w.time}>
            {w.date ? `${w.date}, ` : null}
            <span dir="ltr">{w.time}</span>
          </time>
        ) : (
          <span className="lv-tba">{L.timeTba}</span>
        )}
      </p>
      {opening.state === "open" && opening.joinUrl ? (
        <a
          className="lv-join lv-join--on"
          href={opening.joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={copy.a11y.live.join0}
          aria-describedby="open-live-note"
        >
          <LiveIcon />
          {L.join}
        </a>
      ) : opening.state === "passed" ? (
        <p className="lv-join lv-join--off">{L.ended}</p>
      ) : (
        <button type="button" className="lv-join lv-join--off" aria-disabled="true" aria-describedby="open-live-note">
          <LiveIcon />
          {opening.state === "open" ? L.linkMissing : L.linkOpensLater}
        </button>
      )}
      {opening.state !== "passed" && opening.calendarAvailable ? (
        <a className="lv-cal" href="/api/live/0/ics" download aria-label={copy.a11y.live.addToCalendar0}>
          {L.addToCalendar}
        </a>
      ) : null}
      <span id="open-live-note" className="lv-note">
        {L.linkRegisteredOnly}
      </span>
    </section>
  ) : null;
  return (
    <div className="today today--before">
      <RefreshAtBoundary atIso={nextChangeIso} />
      <section className="t t-hero ar-hero" aria-labelledby="hero-h">
        <SunDoodle className="hero-sun" size={64} />
        <h1 id="hero-h">{withStartDate(copy.locked.beforeStartTitle, startDate)}</h1>
        <p>{fill(withStartDate(copy.locked.beforeStartBody, startDate), times)}</p>
      </section>

      {openingIsToday ? liveCard : null}

      {count ? (
        <section className="t t--half t-count ar-cup" aria-label={daysUntil !== null && daysUntil > 1 ? `${daysUntil} ${B.days}` : undefined}>
          {count}
        </section>
      ) : null}

      <section className={`t t--half t-bs-art ar-ring${count ? "" : " t-bs-art--wide"}`} aria-hidden="true">
        <SprigDoodle size={70} />
      </section>

      <section className="t t-expect ar-video" aria-labelledby="expect-h">
        <h2 id="expect-h">{B.expectHeading}</h2>
        <ul className="expect-list">
          <li>
            <span className="expect-ic expect-ic--sage"><CupIcon /></span>
            {copy.common.actionTypes.habit}
          </li>
          <li>
            <span className="expect-ic expect-ic--sky"><WaveIcon /></span>
            {copy.common.actionTypes.move}
          </li>
          <li>
            <span className="expect-ic expect-ic--sand"><BreathIcon /></span>
            {copy.common.actionTypes.meditate}
          </li>
        </ul>
        <p>{copy.landing.how.lead}</p>
      </section>

      <section className="t t-prepare ar-acts" aria-labelledby="prep-h">
        <h2 id="prep-h">{B.prepare}</h2>
        <p>{fill(copy.landing.how.daily, times)}</p>
        <div className="prep-links">
          <Link href="/reminders" className="btn-p">{B.remindersCta}</Link>
          <Link href="/install" className="btn-p btn-p--soft">{B.installCta}</Link>
        </div>
      </section>

      {openingIsToday ? null : liveCard}

      <section className="t t-note ar-note">
        <p>{copy.locked.schedule}</p>
      </section>
    </div>
  );
}
