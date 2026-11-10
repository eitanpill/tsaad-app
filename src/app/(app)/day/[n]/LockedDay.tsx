import Link from "next/link";
import { copy } from "@/content/copy.he";
import { fill, withStartDate } from "@/lib/format";
import { BellIcon, LockIcon } from "../../_components/icons";

export type LockedReason = "before_start" | "tomorrow" | "far";

/**
 * מסך יום נעול (AppLocked). מקבל רק את מספר היום ונוסחים כלליים: אין כאן כותרות של הרגל, תנועה או מדיטציה,
 * ואין מזהה סרטון. previousDay = היום שעוד אפשר לסמן (אתמול) כשהחלון שלו פתוח.
 */
export function LockedDay({
  day,
  reason,
  previousDay,
  startDate,
}: {
  day: number;
  reason: LockedReason;
  previousDay: number | null;
  startDate: string | undefined;
}) {
  const title =
    reason === "before_start"
      ? withStartDate(copy.locked.beforeStartTitle, startDate)
      : reason === "tomorrow"
        ? fill(copy.locked.title, { n: day })
        : fill(copy.locked.farTitle, { n: day });
  const body =
    reason === "before_start"
      ? withStartDate(copy.locked.beforeStartBody, startDate)
      : reason === "tomorrow"
        ? copy.locked.body
        : copy.locked.farBody;
  return (
    <>
      <section className="t t-lockhero" aria-labelledby="locked-h">
        <div
          className="lock-art"
          role={reason === "tomorrow" ? "img" : undefined}
          aria-label={reason === "tomorrow" ? copy.a11y.locked.time : undefined}
          aria-hidden={reason === "tomorrow" ? undefined : true}
        >
          <svg width="96" height="115" viewBox="0 0 40 48" aria-hidden="true" focusable="false">
            <path d="M5 4 L35 4 L31 44 L9 44 Z" fill="rgba(255,255,255,0.75)" />
            <path d="M5 4 L35 4 L31 44 L9 44 Z" fill="none" stroke="#123021" strokeWidth="1.6" strokeLinejoin="round" strokeDasharray="3 2.5" />
          </svg>
          <i className="lock-stone" />
          <span className="lock-badge">
            <LockIcon />
          </span>
        </div>
        <h1 id="locked-h">{title}</h1>
        <p>{body}</p>
      </section>

      <section className="t t--half t-back">
        {previousDay !== null ? <b>{fill(copy.locked.previousOpen, { prev: previousDay })}</b> : null}
        <Link href="/today" className="btn-light">
          {copy.locked.backToToday}
        </Link>
      </section>
      <section className="t t--half t-past">
        <b>{copy.locked.pastDays}</b>
        <Link href="/path" className="link-s">
          {copy.locked.pastDaysLink}
        </Link>
      </section>

      <section className="t t-bell">
        <span aria-hidden="true" className="bell-dot">
          <BellIcon />
        </span>
        <p>{copy.locked.schedule}</p>
      </section>
    </>
  );
}
