import { useId } from "react";
import type { Fill } from "@/lib/path/view";

const GLASS = "M5 4 L35 4 L31 44 L9 44 Z";

/**
 * כוסית האבן. גובה המים (0, חצי, שלושה רבעים, מלאה) וקו המתאר (מקווקו = עוד לא נפתח) נושאים את המצב,
 * לא הצבע בלבד. דקורטיבי: השם הנגיש בא מהקישור או מהפריט.
 */
export function StoneCup({
  fill,
  dashed = false,
  width = 30,
  height = 36,
  thick = false,
}: {
  fill: Fill;
  dashed?: boolean;
  width?: number;
  height?: number;
  thick?: boolean;
}) {
  const id = useId();
  return (
    <svg className="stone-cup" width={width} height={height} viewBox="0 0 40 48" aria-hidden="true" focusable="false">
      <clipPath id={`${id}-c`}>
        <path d={GLASS} />
      </clipPath>
      <path d={GLASS} fill={thick ? "#F2F4F1" : "rgba(255,255,255,0.7)"} />
      {fill > 0 ? (
        <g clipPath={`url(#${id}-c)`}>
          <g transform={`translate(0 ${(44 - fill * 40).toFixed(1)})`}>
            <path className="wave" d="M-40 0 Q-30 -4 -20 0 T0 0 T20 0 T40 0 T60 0 V60 H-40 Z" fill="#6F8A6E" />
          </g>
        </g>
      ) : null}
      <path
        d={GLASS}
        fill="none"
        stroke="#123021"
        strokeWidth={thick ? 3.5 : 2.6}
        strokeLinejoin="round"
        strokeDasharray={dashed ? (thick ? "5 4" : "3.5 3") : undefined}
      />
    </svg>
  );
}
