import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CheckIcon } from "@/app/(app)/_components/icons";
import { AvitalPhoto } from "@/components/AvitalPhoto";
import { Logo } from "@/components/Logo";
import { getConfig } from "@/config";
import { copy } from "@/content/copy.he";
import { socialLinks } from "@/content/landing-links";
import { fill, formatHeDate, withStartDate } from "@/lib/format";
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
import { FloatingCta } from "../_components/FloatingCta";
// צילום מסך אמיתי מהאפליקציה (משתמשת בדיקה "נועה", יום 4), מקומי (CSP img-src self).
import appToday from "./app-today.jpg";

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
  const startText = cfg.startDate ? withStartDate(L.hero.start, cfg.startDate) : L.hero.startTba;
  const closed = registrationClosed(now, schedule);
  const nextCohortUrl = cfg.env.NEXT_COHORT_URL ?? null;
  const closeHeading = cfg.startDate ? withStartDate(L.close.heading, cfg.startDate) : L.close.headingTba;
  // תאריכים נגזרים מ־START_DATE בלבד: היום האחרון להרשמה. בלי לוח: לא מוצג.
  const closesText = schedule
    ? fill(L.hero.closes, { closeDate: formatHeDate(dayDate(REGISTRATION_LAST_DAY, schedule), { weekday: true }) })
    : null;
  const lives = [L.lives.day0, L.lives.day7, L.lives.day14] as const;
  const links = socialLinks();

  /** בלוק הרשמה: המחיר בגדול, הכפתור, ושורת התאריכים. מופיע שלוש פעמים בדף; אחרי סגירת ההרשמה: שורת "נסגרה". */
  const signup = (where: "hero" | "mid" | "close", dates = true) =>
    closed ? (
      where === "hero" ? <LandingClosed nextUrl={nextCohortUrl} /> : null
    ) : (
      <div className="pt-signup" data-signup={where}>
        <p className="pt-price">
          <span className="amt">
            {L.price.amount} <span className="cur">{L.price.currency}</span>
          </span>
          <span className="pn">{L.price.note}</span>
        </p>
        <LandingCta href={ctaHref} label={where === "close" ? L.close.cta : L.hero.cta} noteId={`cta-note-${where}`} />
        {dates ? (
          <p className="pt-note">
            {startText}
            {closesText ? (
              <>
                <br />
                {closesText}
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    );

  return (
    <main id="main" className="pub-main pub-land">
      <section className="pt pt-hero" aria-labelledby="land-h1">
        <div className="pt-bar">
          <span className="logo">
            <Logo height={26} />
          </span>
        </div>
        <div className="pt-hero-grid">
          <div className="pt-hero-text">
            <p className="pt-eyebrow">{L.hero.eyebrow}</p>
            <h1 id="land-h1">{L.hero.title}</h1>
            <p className="pt-sub">
              <b>{L.hero.subtitle}</b>
              {L.hero.lead}
            </p>
            {signup("hero")}
            <p className="pt-have">
              {L.hero.haveAccount}
              <Link href="/login" className="plink">
                {L.hero.login}
              </Link>
            </p>
          </div>
          <AvitalPhoto slot="hero" variant="hero" priority />
        </div>
      </section>

      <section className="pt pt--white pt-stack pt-pain" aria-labelledby="land-pain-h">
        <h2 id="land-pain-h">{L.pain.heading}</h2>
        <ul className="quotes">
          {L.pain.quotes.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
        <p className="strong">{L.pain.answer}</p>
      </section>

      <section className="pt pt--sand pt-incl" aria-labelledby="land-incl-h">
        <div className="pt-stack">
          <h2 id="land-incl-h">{L.includes.heading}</h2>
          <ul className="ticks">
            {L.includes.items.map((t) => (
              <li key={t}>
                <span className="tick" aria-hidden="true">
                  <CheckIcon />
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <figure className="pt-phone">
          <Image src={appToday} alt={L.includes.shotAlt} sizes="(min-width: 900px) 300px, 62vw" placeholder="empty" />
        </figure>
        {signup("mid", false)}
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
          {signup("close", false)}
        </section>
      )}

      {links.length ? (
        <section className="pt pt--sky pt-social" aria-labelledby="land-social-h">
          <h2 id="land-social-h">{L.social.heading}</h2>
          <ul>
            {links.map((l) => (
              <li key={l.key}>
                <a href={l.href} rel="noopener noreferrer">
                  {L.social[l.key]}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!closed && ctaHref ? <FloatingCta href={ctaHref} label={L.floating} /> : null}
    </main>
  );
}
