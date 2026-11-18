import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import { paint } from "@/components/paint";

const C = 264; // 2π·42

/** טבעת "N מתוך 14". המספר והטקסט שלידה נושאים את הערך; ה־SVG עם תווית נגישה. */
export function Ring({ counted, total = 14, size = 50 }: { counted: number; total?: number; size?: number }) {
  const offset = C * (1 - Math.min(counted, total) / total);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="ring-svg"
      role="img"
      aria-label={fill(copy.a11y.ring, { n: counted })}
    >
      <circle cx="50" cy="50" r="42" fill="none" strokeWidth="11" style={paint(null, "white")} />
      <circle
        className="ring-arc"
        cx="50"
        cy="50"
        r="42"
        fill="none"
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
        style={paint(null, "terracotta")}
      />
      <text x="50" y="62" textAnchor="middle" fontFamily="var(--font-heading), Noto Sans Hebrew, sans-serif" fontWeight="900" fontSize="34" style={paint("maroon")}>
        {counted}
      </text>
    </svg>
  );
}
