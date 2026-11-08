import { useId } from "react";
import type { CupLevel } from "@/lib/days";

const WATER_Y: Record<CupLevel, number | null> = { empty: null, half: 48, three_quarters: 28, full: 10 };
const GLASS = "M8 6 L72 6 L64 90 L16 90 Z";

/** כוס הצעדים של היום. רמת המים וקו המתאר (מקווקו כשריקה) נושאים את המצב, לא הצבע בלבד. הטקסט החלופי בא מהקורא. */
export function Cup({ level, label, width = 58, height = 70 }: { level: CupLevel; label?: string; width?: number; height?: number }) {
  const id = useId();
  const y = WATER_Y[level];
  return (
    <svg
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
      {y !== null ? (
        <g clipPath={`url(#${id}-c)`}>
          <g transform={`translate(0 ${y})`}>
            <path
              className="wave"
              d="M-40 0 Q-30 -5 -20 0 T0 0 T20 0 T40 0 T60 0 T80 0 T100 0 V90 H-40 Z"
              fill="#123021"
            />
          </g>
        </g>
      ) : null}
      <path d="M16 14 L21 80" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="3" strokeLinecap="round" />
      <path
        d={GLASS}
        fill="none"
        stroke="#123021"
        strokeWidth="3.5"
        strokeLinejoin="round"
        strokeDasharray={level === "empty" ? "6 5" : undefined}
      />
    </svg>
  );
}
