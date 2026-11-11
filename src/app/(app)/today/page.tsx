import type { Metadata } from "next";
import { BeforeStart } from "./BeforeStart";
import { TodayBoard } from "./TodayBoard";
import type { DayTitles } from "./action-labels";
import { getConfig } from "@/config";
import { copy } from "@/content/copy.he";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/dal";
import { fill } from "@/lib/format";
import { serverNow } from "@/lib/today/clock";
import { dayOpening, dayTitles } from "@/lib/today/titles";
import { listCompletions } from "@/lib/today/completions";
import { getSchedule } from "@/lib/today/schedule";
import { getVideoConfig, hasVideo, posterUrl } from "@/lib/today/video";
import { firstNameOf } from "@/lib/today/first-name";
import { actionKey, greetingKey, nextBoundary, todayModel } from "@/lib/today/view";
import { stepsFor, unlockInstant } from "@/lib/days";
import { diffDays, localDate } from "@/lib/time/zone";
import { getOfferModel } from "@/lib/offer/config";
import { OfferEntry } from "./OfferEntry";
import { OfferTiles } from "../offer/OfferTiles";

export const metadata: Metadata = { title: `${copy.nav.today} | ${copy.brand.name}` };

export default async function TodayPage() {
  const user = await requireUser();
  const now = await serverNow();
  const schedule = getSchedule();
  const cfg = getConfig();
  const model = todayModel(now, schedule);

  if (model.phase === "before_start" || !schedule) {
    const first = schedule ? unlockInstant(1, schedule) : null;
    const daysUntil = schedule ? diffDays(localDate(now, schedule.timeZone), schedule.startDate) : null;
    return (
      <BeforeStart startDate={cfg.startDate} daysUntil={daysUntil} nextChangeIso={first && first.getTime() > now.getTime() ? first.toISOString() : null} />
    );
  }

  const rows = await listCompletions(getDb(), user.userId);
  const completions = rows.map((r) => actionKey(r.day, r.action));
  const day = model.day;
  const yesterday = model.yesterday;
  const yesterdayDone = yesterday ? stepsFor(yesterday, rows.filter((r) => r.day === yesterday).map((r) => r.action)) : 0;
  const tz = schedule.timeZone;

  const greeting = copy.today.greeting[greetingKey(now, tz)];
  const first = firstNameOf(user.displayName, user.username);
  const greetText = first ? fill(copy.today.greetingName, { greeting, name: first }) : greeting;
  // הכותרת היא הברכה (בשם הפרטי כשיש); שם ההרגל כבר בשורת הפתיחה ובכפתור, ולא חוזר בכותרת. ביום לייב: ההודעה על המפגש.
  let eyebrow: string = copy.today.ended;
  let hero: string = greetText;
  if (day !== null) {
    eyebrow = model.live ? greetText : fill(copy.today.dayChip, { n: day });
    if (model.live) hero = copy.today.heroLive;
  }
  const next = nextBoundary(now, schedule);
  // רק היום ואתמול: כותרות של ימים נעולים לא נשלחות ללקוח.
  const titles: Record<number, DayTitles> = {};
  for (const d of [day, yesterday]) if (d !== null) titles[d] = dayTitles(d);

  // יום 14 ואחריו: אריח קטן אל ההצעות (מצב ההצעה נקבע בשרת; בלי קישורים ובלי מחירים כאן).
  const offerModel = day === 14 || model.phase === "ended" ? getOfferModel(now, schedule) : null;
  const offerOpen = offerModel?.offer.state === "open";
  // אחרי יום 14, כשחלון ההצעה פתוח: ההצעות עצמן על אותו מסך (אותם אריחים כמו ב־/offer). אחרת, האריח הקטן אל /offer.
  const offerEntry = !offerModel ? null : model.phase === "ended" && offerOpen ? (
    <OfferTiles m={offerModel} headingLevel={2} />
  ) : (
    <OfferEntry offer={offerModel.offer} />
  );

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
        eyebrow={eyebrow}
        hero={hero}
        opening={day !== null ? dayOpening(day) : null}
        titles={titles}
        videoAvailable={day !== null && hasVideo(day, getVideoConfig(cfg.env))}
        poster={day !== null ? posterUrl(day, getVideoConfig(cfg.env), cfg.env.BUNNY_CDN_HOST) : null}
        offerOpen={offerOpen}
        nextChangeIso={next ? next.toISOString() : null}
      >
        {offerEntry}
      </TodayBoard>
    </>
  );
}
