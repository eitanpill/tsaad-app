import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { MotionToggle } from "@/app/(app)/_components/MotionToggle";
import { CheckIcon } from "@/app/(app)/_components/icons";
import { Logo } from "@/components/Logo";
import { getConfig } from "@/config";
import { copy } from "@/content/copy.he";
import { DAYS } from "@/content/days";
import { fill, withStartDate } from "@/lib/format";
import { timeTokens } from "@/lib/times";
import { getLiveInputs } from "@/lib/live/config";
import { liveSessions, liveWhen, type LiveSession } from "@/lib/live/model";
import { getOfferLinks } from "@/lib/offer/config";
import { serverNow } from "@/lib/today/clock";
import { getSchedule } from "@/lib/today/schedule";
import { connection } from "next/server";
import { getAppOrigin } from "@/lib/auth/config";
import { LandingCta } from "../_components/LandingCta";
import { LandingCup, LandingPath, LandingRing } from "../_components/LandingPath";

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

/** מחליף מציין מקום בתוך משפט בצומת (למשל שעה). */
function slot(template: string, token: string, node: ReactNode): ReactNode {
  const [before, after] = template.split(token);
  return (
    <>
      {before}
      {node}
      {after}
    </>
  );
}

function whenNode(s: LiveSession, tz: string): ReactNode {
  const w = liveWhen(s, tz);
  if (!w) return copy.live.timeTba;
  return (
    <>
      {w.date ? `${w.date}, ` : null}
      <span className="ltr">{w.time}</span>
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
  const ctaHref = getOfferLinks(cfg.env).challenge;
  const day1 = DAYS[0];
  const startText = cfg.startDate ? withStartDate(L.hero.start, cfg.startDate) : L.hero.startTba;
  const closeHeading = cfg.startDate ? withStartDate(L.close.heading, cfg.startDate) : L.close.headingTba;

  return (
    <main id="main" className="pub-main">
      <section className="pt pt-hero" aria-labelledby="land-h1">
        <svg className="rings" aria-hidden="true" focusable="false" width="220" height="220" viewBox="0 0 220 220">
          <circle cx="110" cy="110" r="100" fill="none" stroke="#BB6F51" strokeWidth="2" />
          <circle cx="110" cy="110" r="74" fill="none" stroke="#BB6F51" strokeWidth="2" />
          <circle cx="110" cy="110" r="48" fill="none" stroke="#BB6F51" strokeWidth="2" />
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
        <h1 id="land-h1">{L.hero.title}</h1>
        <p className="pt-sub">
          <b>{L.hero.subtitle}</b>
          {L.hero.lead}
        </p>
        <LandingCta href={ctaHref} label={L.hero.cta} noteId="cta-note-hero" />
        <p className="pt-note">
          {L.hero.price}
          <br />
          {startText}
        </p>
        <p className="pt-have">
          {L.hero.haveAccount}
          <Link href="/login" className="plink">
            {L.hero.login}
          </Link>
        </p>
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
          <p>{fill(L.how.daily, timeTokens())}</p>
          <p>{L.how.access}</p>
        </div>
      </section>

      <section className="pt pt--sky pt-stack" aria-labelledby="land-aud-h">
        <h2 id="land-aud-h">{L.audience.heading}</h2>
        <p>{L.audience.body}</p>
      </section>

      <section className="pt pt--sage pt-stack" aria-labelledby="land-av-h">
        <h2 id="land-av-h">{L.avital.heading}</h2>
        <p>{L.avital.body}</p>
      </section>

      <section className="pt pt--sand pt-lives" aria-labelledby="land-live-h">
        <h2 id="land-live-h">{L.lives.heading}</h2>
        <ul>
          <li>{slot(L.lives.day7, "[LIVE_DAY7_TIME]", whenNode(sessions[0], cfg.timeZone))}</li>
          <li>{slot(L.lives.day14, "[LIVE_DAY14_TIME]", whenNode(sessions[1], cfg.timeZone))}</li>
        </ul>
        <p className="n">{L.lives.note}</p>
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

      <section className="pt pt--forest pt-close pt-stack" aria-labelledby="land-close-h">
        <h2 id="land-close-h">{closeHeading}</h2>
        <p>{L.close.body}</p>
        <LandingCta href={ctaHref} label={L.close.cta} noteId="cta-note-close" />
      </section>
    </main>
  );
}
