import { useId } from "react";
import type { CupLevel } from "@/lib/days";
import { paint } from "@/components/paint";

/** גובה פני המים (בקואורדינטות ה־SVG). "empty" מניח אותם מתחת לכוס, כדי שהעלייה תתחיל מלמטה. */
const WATER_Y: Record<CupLevel, number> = { empty: 124, half: 66, three_quarters: 46, full: 26 };
/** כוס קרמיקה בעבודת יד: דפנות מעט קמורות, תחתית מעוגלת. */
const BODY = "M14 18 C15 60 18 96 26 106 C34 115 66 115 74 106 C82 96 85 60 86 18";
/** גל רחב (מחזור של 50) שנע לאט ימינה ושמאלה; שתי שכבות: פני המים בהירים, המים עצמם עמוקים יותר. */
const WAVE = "M-100 0 q12.5 -5 25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 V110 H-100 Z";

/**
 * כוס הצעדים של היום. רמת המים נושאת את המצב, לא הצבע בלבד; הטקסט החלופי בא מהקורא.
 * המים עולים בהדרגה (transition ב־CSS) כשהרמה משתנה, ופני המים נעים לאט; `burst` (מספר שעולה בכל מילוי מלא)
 * מציג אדים וניצוצות קצרים. בלי תנועה (prefers-reduced-motion או עצירת האנימציה) המים קופצים לרמה החדשה ולא נעים.
 */
export function Cup({
  level,
  label,
  width = 58,
  height = 70,
  burst = 0,
}: {
  level: CupLevel;
  label?: string;
  width?: number;
  height?: number;
  burst?: number;
}) {
  const id = useId();
  const y = WATER_Y[level];
  return (
    <svg
      className="cup-svg"
      width={width}
      height={height}
      viewBox="0 0 100 120"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <clipPath id={`${id}-c`}>
        <path d={`${BODY} Z`} />
      </clipPath>
      <ellipse cx="50" cy="114" rx="34" ry="5" fill="rgba(46,8,8,0.08)" />
      <path d={`${BODY} Z`} fill="rgba(255,255,255,0.82)" />
      <g clipPath={`url(#${id}-c)`}>
        <g className="cup-water" style={{ transform: `translateY(${y}px)` }}>
          <g className="wave">
            <path d={WAVE} style={paint("water-light")} />
            <path d={WAVE} transform="translate(0 5)" style={paint("water")} />
          </g>
        </g>
      </g>
      <path d="M24 30 C25 58 27 80 32 94" fill="none" strokeOpacity="0.85" strokeWidth="3" strokeLinecap="round" style={paint(null, "white")} />
      <path d={BODY} fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={paint(null, "maroon")} />
      <ellipse cx="50" cy="18" rx="36" ry="5.5" fill="none" strokeWidth="2.6" style={paint(null, "maroon")} />
      {level === "full" ? (
        <g className="cup-steam" aria-hidden="true" fill="none" strokeWidth="2.2" strokeLinecap="round" style={paint(null, "terracotta")}>
          <path d="M40 8 c-4 -5 4 -8 0 -13" />
          <path d="M60 8 c-4 -5 4 -8 0 -13" />
        </g>
      ) : null}
      {burst > 0 && level === "full" ? (
        <g key={burst} className="cup-burst" aria-hidden="true">
          <path className="sp sp1" d="M16 6 C 13 -2 10 -5 7 -7 C 13 -6 17 -2 16 6 Z" style={paint("water")} />
          <path className="sp sp2" d="M50 2 C 47 -7 44 -11 41 -14 C 48 -12 52 -7 50 2 Z" style={paint("water")} />
          <path className="sp sp3" d="M84 6 C 87 -2 90 -5 93 -7 C 87 -6 83 -2 84 6 Z" style={paint("water")} />
          <path className="sp sp4" d="M30 -2 l2.2 -6 l2.2 6 l6 2.2 l-6 2.2 l-2.2 6 l-2.2 -6 l-6 -2.2 Z" style={paint("terracotta")} />
          <path className="sp sp5" d="M70 -4 l1.8 -5 l1.8 5 l5 1.8 l-5 1.8 l-1.8 5 l-1.8 -5 l-5 -1.8 Z" style={paint("terracotta")} />
        </g>
      ) : null}
    </svg>
  );
}
