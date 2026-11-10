import Link from "next/link";
import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import type { Stone } from "@/lib/path/view";

/**
 * רצועת השביל במסך היום: 14 האבנים בשורה קטנה, היום מודגש. הרצועה כולה קישור ל־/path.
 * השם הנגיש מסכם את ההתקדמות ("יום 4 מתוך 14, 3 ימים נספרו"); האבנים עצמן דקורטיביות.
 * המצב לא נשען על הצבע: אבן שנספרה מלאה ועם סימון וי, אבן היום גדולה יותר עם טבעת, אבן של אתמול עם נקודה,
 * אבן שעוד לא נפתחה מקווקוות.
 */
export function PathStrip({ stones, counted, day }: { stones: Stone[]; counted: number; day: number | null }) {
  const label =
    day === null
      ? fill(copy.a11y.strip.noDay, { counted })
      : counted === 1
        ? fill(copy.a11y.strip.oneCounted, { day })
        : fill(copy.a11y.strip.counted, { day, counted });
  return (
    <section className="t t-strip" aria-label={copy.a11y.strip.region}>
      <Link href="/path" className="strip-link" aria-label={label} prefetch={false}>
        <span className="strip-stones" aria-hidden="true">
          {stones.map((s) => (
            <span key={s.day} className={`sstone sstone--${s.state}${s.live ? " sstone--live" : ""}`}>
              <i className="sstone-dot">
                {s.state === "counted" ? (
                  <svg width="10" height="10" viewBox="0 0 14 14" focusable="false">
                    <path d="M2.5 7.5 L5.8 10.5 L11.5 3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
                {s.state === "yesterday" ? <b className="sstone-clock" /> : null}
              </i>
              <span className="sstone-n">{s.day}</span>
            </span>
          ))}
        </span>
        <span className="strip-more" aria-hidden="true">{copy.today.strip.link}</span>
      </Link>
    </section>
  );
}
