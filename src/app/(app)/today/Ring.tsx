import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import { paint } from "@/components/paint";

/**
 * מספר ימי התרגול, בתוך טיפת מים (בלי קשת "מתוך 14": אין כאן מדד שצריך להשלים).
 * המספר והטקסט שלידה נושאים את הערך; ה־SVG עם תווית נגישה. השם נשאר Ring בשביל הקוראים הקיימים.
 */
export function Ring({ counted, size = 50 }: { counted: number; total?: number; size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 56) / 50}
      viewBox="0 0 100 112"
      className="ring-svg"
      role="img"
      aria-label={fill(copy.a11y.ring, { n: counted })}
    >
      <path
        className="ring-arc"
        d="M50 4 C62 26 90 50 90 72 C90 94 72 108 50 108 C28 108 10 94 10 72 C10 50 38 26 50 4 Z"
        style={paint("water-light")}
      />
      <path d="M30 70 C30 82 36 90 46 94" fill="none" strokeWidth="5" strokeLinecap="round" strokeOpacity="0.8" style={paint(null, "white")} />
      <text x="50" y="86" textAnchor="middle" fontFamily="var(--font-heading), Noto Sans Hebrew, sans-serif" fontWeight="800" fontSize="40" style={paint("forest")}>
        {counted}
      </text>
    </svg>
  );
}
