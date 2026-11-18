import { useId } from "react";
import type { CupLevel } from "@/lib/days";
import { paint } from "@/components/paint";

/** גובה פני המים (בקואורדינטות ה־SVG). "empty" מניח אותם מתחת לכוס, כדי שהעלייה תתחיל מלמטה. */
const WATER_Y: Record<CupLevel, number> = { empty: 98, half: 48, three_quarters: 28, full: 10 };
const GLASS = "M8 6 L72 6 L64 90 L16 90 Z";

/**
 * כוס הצעדים של היום. רמת המים וקו המתאר (מקווקו כשריקה) נושאים את המצב, לא הצבע בלבד. הטקסט החלופי בא מהקורא.
 * המים עולים בהדרגה (transition ב־CSS) כשהרמה משתנה; `burst` (מספר שעולה בכל מילוי מלא) מציג התזה קצרה וניצוצות.
 * בלי תנועה (prefers-reduced-motion או עצירת האנימציה) המים קופצים לרמה החדשה והניצוצות לא מוצגים: המצב ברור גם כך.
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
      viewBox="0 0 80 96"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <clipPath id={`${id}-c`}>
        <path d={GLASS} />
      </clipPath>
      <path d={GLASS} fill="rgba(255,255,255,0.6)" />
      <g clipPath={`url(#${id}-c)`}>
        <g className="cup-water" style={{ transform: `translateY(${y}px)` }}>
          <path
            className="wave"
            d="M-40 0 Q-30 -5 -20 0 T0 0 T20 0 T40 0 T60 0 T80 0 T100 0 V100 H-40 Z"
            style={paint("forest")}
          />
        </g>
      </g>
      <path d="M16 14 L21 80" strokeOpacity="0.8" strokeWidth="3" strokeLinecap="round" style={paint(null, "white")} />
      <path
        d={GLASS}
        fill="none"
        strokeWidth="3.5"
        strokeLinejoin="round"
        strokeDasharray={level === "empty" ? "6 5" : undefined}
        style={paint(null, "forest")}
      />
      {burst > 0 && level === "full" ? (
        <g key={burst} className="cup-burst" aria-hidden="true">
          <path className="sp sp1" d="M14 2 C 11 -6 8 -9 5 -11 C 11 -10 15 -6 14 2 Z" style={paint("water")} />
          <path className="sp sp2" d="M40 0 C 37 -9 34 -13 31 -16 C 38 -14 42 -9 40 0 Z" style={paint("water")} />
          <path className="sp sp3" d="M66 2 C 69 -6 72 -9 75 -11 C 69 -10 65 -6 66 2 Z" style={paint("water")} />
          <path className="sp sp4" d="M26 -4 l2.2 -6 l2.2 6 l6 2.2 l-6 2.2 l-2.2 6 l-2.2 -6 l-6 -2.2 Z" style={paint("terracotta")} />
          <path className="sp sp5" d="M56 -6 l1.8 -5 l1.8 5 l5 1.8 l-5 1.8 l-1.8 5 l-1.8 -5 l-5 -1.8 Z" style={paint("terracotta")} />
        </g>
      ) : null}
    </svg>
  );
}
