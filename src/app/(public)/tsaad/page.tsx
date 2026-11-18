import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { MotionToggle } from "@/app/(app)/_components/MotionToggle";
import { CheckIcon } from "@/app/(app)/_components/icons";
import { AvitalPhoto } from "@/components/AvitalPhoto";
import { Logo } from "@/components/Logo";
import { getConfig } from "@/config";
import { copy } from "@/content/copy.he";
import { DAYS } from "@/content/days";
import { fill, formatHeDate, withStartDate } from "@/lib/format";
import { timeTokens } from "@/lib/times";
import { getLiveInputs } from "@/lib/live/config";
import { liveDate, liveSessions, type LiveSession } from "@/lib/live/model";
import { getOfferLinks } from "@/lib/offer/config";
import { goHref } from "@/lib/offer/links";
import { serverNow } from "@/lib/today/clock";
import { getSchedule } from "@/lib/today/schedule";
import { connection } from "next/server";
import { getAppOrigin } from "@/lib/auth/config";
import { dayDate, registrationClosed, REGISTRATION_LAST_DAY, type Schedule } from "@/lib/days";
import { LandingCta, LandingClosed } from "../_components/LandingCta";
import { LandingCup, LandingPath, LandingRing } from "../_components/LandingPath";
import { paint } from "@/components/paint";

const L = copy.landing;

/** דף נחיתה ציבורי: SEO מלא (כותרת, תיאור, OG, canonical) ו־robots מאפשר. אין תמונת OG (אין נכס מאושר). */
export function generateMetadata(): Metadata {
  let metadataBase: URL | undefined;
  try {
    const o = getAppOrigin();
    metadataBase = o ? new URL(o) : undefined;
  } catch {
    metadataBase = undefined;
  }
  return {
    metadataBase,
    title: L.meta.title,
    description: L.meta.description,
    alternates: { canonical: "/tsaad" },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "he_IL",
      siteName: copy.brand.name,
      title: L.meta.title,
      description: L.meta.description,
      url: "/tsaad",
    },
    twitter: { card: "summary", title: L.meta.title, description: L.meta.description },
  };
}

/**
 * מועד מפגש לייב: התאריך תמיד מהלוח (START_DATE), השעה רק כשהוגדרה. בלי לוח: "השעה תפורסם בקרוב" בלבד (אין תאריך מומצא).
 */
function whenNode(s: LiveSession, schedule: Schedule | null): ReactNode {
  const date = schedule ? formatHeDate(liveDate(s.day, schedule), { weekday: true }) : null;
  if (!s.time) return date ? `${date}. ${copy.live.timeTba}` : copy.live.timeTba;
  return (
    <>
      {date ? `${date}, ` : null}
      <span className="ltr">{s.time}</span>
    </>
  );
}

export default async function LandingPage() {
  // The live times and start date depend on the request clock: render per request (before anything reads the time).
  await connection();
  const cfg = getConfig();
  const now = await serverNow();
  const schedule = getSchedule();
  const sessions = liveSessions(now, schedule, getLiveInputs(cfg.env));
  const ctaHref = goHref("challenge", getOfferLinks(cfg.env).challenge);
  const day1 = DAYS[0];
  const times = timeTokens();
  const startText = cfg.startDate ? withStartDate(L.hero.start, cfg.startDate) : L.hero.startTba;
  const closed = registrationClosed(now, schedule);
  const nextCohortUrl = cfg.env.NEXT_COHORT_URL ?? null;
  const closeHeading = cfg.startDate ? withStartDate(L.close.heading, cfg.startDate) : L.close.headingTba;
  // תאריכים נגזרים מ־START_DATE בלבד: היום האחרון להרשמה, ויום מפגש הפתיחה. בלי לוח: לא מוצגים.
  const closesText = schedule
    ? fill(L.hero.closes, { closeDate: formatHeDate(dayDate(REGISTRATION_LAST_DAY, schedule), { weekday: true }) })
    : null;
  const startStep = schedule
    ? fill(withStartDate(L.steps.start, cfg.startDate), { day0Date: formatHeDate(liveDate(0, schedule), { weekday: true }) })
    : L.steps.startTba;
  const lives = [L.lives.day0, L.lives.day7, L.lives.day14] as const;

  const signup = (where: "hero" | "close") => (
    <>
      <LandingCta href={ctaHref} label={where === "hero" ? L.hero.cta : L.close.cta} noteId={`cta-note-${where}`} />
      <p className="pt-note">
        {L.hero.price}
        <br />
        {startText}
        {closesText ? (
          <>
            <br />
            {closesText}
          </>
        ) : null}
      </p>
    </>
  );

  return (
    <main id="main" className="pub-main pub-land">
      <section className="pt pt-hero" aria-labelledby="land-h1">
        <svg className="rings" aria-hidden="true" focusable="false" width="220" height="220" viewBox="0 0 220 220">
          <circle cx="110" cy="110" r="100" fill="none" strokeWidth="2" style={paint(null, "terracotta")} />
          <circle cx="110" cy="110" r="74" fill="none" strokeWidth="2" style={paint(null, "terracotta")} />
          <circle cx="110" cy="110" r="48" fill="none" strokeWidth="2" style={paint(null, "terracotta")} />
        </svg>
        <div className="pt-bar">
          <span className="logo">
            <Logo height={24} />
          </span>
          <span className="by">
            <span>{copy.brand.byline}</span>
            <MotionToggle />
          </span>
        </div>
        <p className="pt-eyebrow">{L.hero.eyebrow}</p>
        <h1 id="land-h1">{L.hero.title}</h1>
        <p className="pt-sub">
          <b>{L.hero.subtitle}</b>
          {L.hero.lead}
        </p>
        {closed ? <LandingClosed nextUrl={nextCohortUrl} /> : signup("hero")}
        <p className="pt-have">
          {L.hero.haveAccount}
          <Link href="/login" className="plink">
            {L.hero.login}
          </Link>
        </p>
      </section>

      <section className="pt pt--white pt-stack pt-pain" aria-labelledby="land-pain-h">
        <h2 id="land-pain-h">{L.pain.heading}</h2>
        <ul className="quotes">
          {L.pain.quotes.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
        <p>{L.pain.body}</p>
        <p className="strong">{L.pain.answer}</p>
      </section>

      <section className="pt pt-how" aria-labelledby="land-how-h">
        <h2 id="land-how-h">{L.how.heading}</h2>
        <p>{L.how.lead}</p>
        <ul aria-label={L.illustration}>
          <li className="pt-act pt-act--done">
            <b>{L.how.habit}</b>
            {day1.habit.title}
            <span className="disc" aria-hidden="true">
              <CheckIcon />
            </span>
          </li>
          <li className="pt-act">
            <b>{L.how.move}</b>
            {day1.movement.title}
          </li>
          <li className="pt-act">
            <b>{L.how.meditate}</b>
            {day1.meditation.title}
          </li>
        </ul>
        <div className="facts">
          <p className="ex">{L.how.example}</p>
          <p>{fill(L.how.daily, times)}</p>
        </div>
      </section>

      <section className="pt pt-path" aria-labelledby="land-map-h">
        <div className="pt-path-top">
          <h2 id="land-map-h">{L.map.heading}</h2>
          <span>{L.how.completion}</span>
        </div>
        <LandingPath />
        <div className="pt-path-cap">
          <b>{L.map.liveTitle}</b>
          <span>{L.map.lead}</span>
        </div>
      </section>

      <div className="pt pt--half pt--white pt-fig pt-ring-tile">
        <LandingRing />
        <span>{copy.today.counted}</span>
      </div>
      <div className="pt pt--half pt--sage pt-fig pt-cup-tile">
        <LandingCup />
        <span>
          {fill(copy.today.dayChip, { n: 4 })} · {copy.today.cup.one}
        </span>
      </div>

      <section className="pt pt--sand pt-stack pt-incl" aria-labelledby="land-incl-h">
        <h2 id="land-incl-h">{L.includes.heading}</h2>
        <ul className="ticks">
          {L.includes.items.map((t) => (
            <li key={t}>
              <span className="tick" aria-hidden="true">
                <CheckIcon />
              </span>
              <span>{fill(t, times)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="pt pt--white pt-stack pt-weeks" aria-labelledby="land-weeks-h">
        <h2 id="land-weeks-h">{L.weeks.heading}</h2>
        <p>{L.weeks.lead}</p>
        <div className="wk-grid">
          {L.weeks.items.map((w, i) => (
            <div key={w.title} className={`wk wk--${i + 1}`}>
              <h3>{w.title}</h3>
              <p>{w.body}</p>
              <p className="wk-s">{L.weeks.sample}</p>
              <ul>
                {w.days.map((n) => (
                  <li key={n}>
                    <b>{fill(L.weeks.day, { n })}</b> {DAYS[n - 1].habit.title}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="pt pt--forest pt-lives" aria-labelledby="land-live-h">
        <h2 id="land-live-h">{L.lives.heading}</h2>
        <ul>
          {sessions.map((s, i) => (
            <li key={s.day}>
              <b>{lives[i]}</b>
              <span>{whenNode(s, schedule)}</span>
            </li>
          ))}
        </ul>
        <p className="n">{L.lives.note}</p>
      </section>

      <section className="pt pt--sage pt-stack pt-av" aria-labelledby="land-av-h">
        <h2 id="land-av-h">{L.avital.heading}</h2>
        <AvitalPhoto slot="about" variant="tile" />
        <p>{L.avital.body}</p>
        <p>{L.avital.more}</p>
      </section>

      <section className="pt pt--sky pt-stack pt-aud" aria-labelledby="land-aud-h">
        <h2 id="land-aud-h">{L.audience.heading}</h2>
        <ul className="ticks">
          {L.audience.items.map((t) => (
            <li key={t}>
              <span className="tick" aria-hidden="true">
                <CheckIcon />
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <h3>{L.audience.notHeading}</h3>
        <p>{L.audience.not}</p>
      </section>

      <section className="pt pt--sand pt-stack pt-steps" aria-labelledby="land-steps-h">
        <h2 id="land-steps-h">{L.steps.heading}</h2>
        <ol>
          {[...L.steps.items, startStep].map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </section>

      <section className="pt pt--white pt-stack pt-price" aria-labelledby="land-price-h">
        <h2 id="land-price-h">{L.price.heading}</h2>
        <p>{L.price.body}</p>
      </section>

      <section className="pt pt-faq" aria-labelledby="land-faq-h">
        <h2 id="land-faq-h">{L.faq.heading}</h2>
        {L.faq.items.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>

      {closed ? null : (
        <section className="pt pt--forest pt-close pt-stack" aria-labelledby="land-close-h">
          <h2 id="land-close-h">{closeHeading}</h2>
          <p>{L.close.body}</p>
          {signup("close")}
        </section>
      )}
    </main>
  );
}
