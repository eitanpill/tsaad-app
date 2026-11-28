import type { Metadata } from "next";
import { BeforeStart } from "./BeforeStart";
import { TodayBoard } from "./TodayBoard";
import type { DayTitles } from "./action-labels";
import { getConfig } from "@/config";
import { copy } from "@/content/copy.he";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/dal";
import { fill } from "@/lib/format";
import { getAppClock } from "@/lib/preview/context";
import { OPENING_INVITE, dayOpeningLead, dayTitles } from "@/lib/today/titles";
import { listCompletions } from "@/lib/today/completions";
import { listDayHabitChecks } from "@/lib/habits/checks";
import { getHabitList } from "@/lib/habits/list";
import { getAudioConfig, hasAudio } from "@/lib/today/audio";
import { getVideoConfig, hasVideo, posterUrl } from "@/lib/today/video";
import { firstNameOf } from "@/lib/today/first-name";
import { actionKey, greetingKey, nextBoundary, todayModel } from "@/lib/today/view";
import { stepsFor, unlockInstant } from "@/lib/days";
import { diffDays, localDate } from "@/lib/time/zone";
import { getLiveInputs } from "@/lib/live/config";
import { liveDate, liveSession, nextLiveChange } from "@/lib/live/model";
import { getOfferModel } from "@/lib/offer/config";
import { OfferEntry } from "./OfferEntry";
import { OfferTiles } from "../offer/OfferTiles";

export const metadata: Metadata = { title: `${copy.nav.today} | ${copy.brand.name}` };

export default async function TodayPage() {
  const user = await requireUser();
  const { now, schedule, previewDay } = await getAppClock();
  const cfg = getConfig();
  const model = todayModel(now, schedule);

  if (model.phase === "before_start" || !schedule) {
    const first = schedule ? unlockInstant(1, schedule) : null;
    const daysUntil = schedule ? diffDays(localDate(now, schedule.timeZone), schedule.startDate) : null;
    // מפגש הפתיחה (יום 0, היום שלפני START_DATE). בלי START_DATE אין תאריך, ולכן גם שעה לא מוצגת (לא ממציאים).
    const opening = liveSession(0, now, schedule, schedule ? getLiveInputs(cfg.env)[0] : {});
    const openingIsToday = schedule !== null && localDate(now, schedule.timeZone) === liveDate(0, schedule);
    const nextMs = [first && first.getTime() > now.getTime() ? first : null, nextLiveChange([opening])]
      .filter((d): d is Date => d !== null)
      .map((d) => d.getTime());
    return (
      <BeforeStart
        startDate={cfg.startDate}
        daysUntil={daysUntil}
        nextChangeIso={nextMs.length ? new Date(Math.min(...nextMs)).toISOString() : null}
        opening={opening}
        openingIsToday={openingIsToday}
        timeZone={cfg.timeZone}
      />
    );
  }

  const db = getDb();
  const rows = await listCompletions(db, user.userId);
  const completions = rows.map((r) => actionKey(r.day, r.action));
  const day = model.day;
  const yesterday = model.yesterday;
  const yesterdayDone = yesterday ? stepsFor(yesterday, rows.filter((r) => r.day === yesterday).map((r) => r.action)) : 0;
  const tz = schedule.timeZone;
  // "ההרגלים שלי": ההרגלים 1..היום (כולם כבר נפתחו) והישנים שסומנו היום.
  const habits = day !== null ? getHabitList(day).map(({ habitDay, title }) => ({ habitDay, title })) : [];
  const olderChecked = day !== null ? await listDayHabitChecks(db, user.userId, day) : [];

  const greeting = copy.today.greeting[greetingKey(now, tz)];
  const first = firstNameOf(user.displayName, user.username);
  const greetText = first ? fill(copy.today.greetingName, { greeting, name: first }) : greeting;
  // הכותרת היא הברכה (בשם הפרטי כשיש); שם ההרגל כבר בשורת הפתיחה ובכפתור, ולא חוזר בכותרת. ביום לייב: ההודעה על המפגש.
  // מספר היום כבר בתג שבכותרת העליונה ובשורת הפתיחה ("יום 4. ההרגל של היום: ..."), ולכן אין שורה קטנה נוספת ביום רגיל.
  // ביום לייב: "היום יש מפגש לייב" רק עד שהמפגש הסתיים (סוף חלון הקישור). אחריו, הברכה הרגילה.
  const todayLive = model.live && day !== null ? liveSession(day as 7 | 14, now, schedule, getLiveInputs(cfg.env)[day as 7 | 14]) : null;
  const liveAhead = todayLive !== null && todayLive.state !== "passed";
  let eyebrow: string | null = copy.today.ended;
  let hero: string = greetText;
  if (day !== null) {
    eyebrow = liveAhead ? greetText : null;
    if (liveAhead) hero = copy.today.heroLive;
  }
  // "קחו נשימה אחת איתי, ומתחילים" רק לפני שמתחילים: לא בערב ולא אחרי מפגש הלייב. הלקוח מסתיר אותה גם אחרי הסימון הראשון.
  const opening =
    day === null
      ? null
      : { lead: dayOpeningLead(day), invite: greetingKey(now, tz) !== "evening" && !(todayLive && !liveAhead) ? OPENING_INVITE : null };
  const boundaries = [nextBoundary(now, schedule), todayLive ? nextLiveChange([todayLive]) : null]
    .filter((d): d is Date => d !== null)
    .map((d) => d.getTime());
  const next = boundaries.length ? new Date(Math.min(...boundaries)) : null;
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
        opening={opening}
        titles={titles}
        habits={habits}
        olderChecked={olderChecked}
        videoAvailableLong={day !== null && hasVideo(day, getVideoConfig(cfg.env))}
        videoAvailableShort={day !== null && hasVideo(day, getVideoConfig(cfg.env), "short")}
        audioAvailable={day !== null && hasAudio(day, getAudioConfig(cfg.env))}
        previewing={previewDay !== null}
        poster={day !== null ? posterUrl(day, getVideoConfig(cfg.env), cfg.env.BUNNY_CDN_HOST) : null}
        offerOpen={offerOpen}
        nextChangeIso={next ? next.toISOString() : null}
      >
        {offerEntry}
      </TodayBoard>
    </>
  );
}
