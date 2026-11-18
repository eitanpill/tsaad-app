import { useId } from "react";
import type { Fill } from "@/lib/path/view";
import { paint } from "@/components/paint";

/** אותה כוס קרמיקה של מסך היום, בקטן (מערכת קואורדינטות 100 על 120). */
const BODY = "M14 18 C15 60 18 96 26 106 C34 115 66 115 74 106 C82 96 85 60 86 18";

/**
 * כוסית האבן. גובה המים (0, חצי, שלושה רבעים, מלאה) וקו המתאר (מקווקו = עוד לא נפתח) נושאים את המצב,
 * לא הצבע בלבד. דקורטיבי: השם הנגיש בא מהקישור או מהפריט.
 */
export function StoneCup({
  fill,
  dashed = false,
  width = 32,
  height = 38,
  thick = false,
}: {
  fill: Fill;
  dashed?: boolean;
  width?: number;
  height?: number;
  thick?: boolean;
}) {
  const id = useId();
  // fill 1 = פני המים ב־26, 0 = מתחת לתחתית (112).
  const top = 112 - fill * 86;
  const stroke = thick ? 9 : 6;
  return (
    <svg className="stone-cup" width={width} height={height} viewBox="0 0 100 120" aria-hidden="true" focusable="false">
      <clipPath id={`${id}-c`}>
        <path d={`${BODY} Z`} />
      </clipPath>
      <path d={`${BODY} Z`} fill={dashed ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.9)"} />
      {fill > 0 ? (
        <g clipPath={`url(#${id}-c)`}>
          <rect x="0" y={top.toFixed(1)} width="100" height="120" style={paint("water-light")} />
          <rect x="0" y={(top + 8).toFixed(1)} width="100" height="120" style={paint("water")} />
        </g>
      ) : null}
      <path
        d={BODY}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? "11 10" : undefined}
        style={paint(null, dashed ? "muted" : "maroon")}
      />
      <ellipse
        cx="50"
        cy="18"
        rx="36"
        ry="5.5"
        fill="none"
        strokeWidth={stroke}
        strokeDasharray={dashed ? "11 10" : undefined}
        style={paint(null, dashed ? "muted" : "maroon")}
      />
    </svg>
  );
}
