import { useId } from "react";
import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";

/** איור בלבד (לא נתוני משתמש): שביל של 14 אבנים בצורת המסך האמיתי, 4 ימים "נספרו" כדוגמה. כל הצורות תחת תווית אחת. */
const POINTS: ReadonlyArray<readonly [number, number]> = [
  [336, 80], [276, 72], [214, 70], [152, 72], [92, 80], [42, 118], [96, 150],
  [170, 156], [246, 162], [320, 186], [290, 224], [214, 232], [136, 234], [58, 236],
];
const FILLS = [1, 0.75, 1, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const TODAY = 3;
const COUNTED = 4;
const LIVE_STONES = new Set([6, 13]);

export function LandingPath() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 366 262" role="img" aria-label={fill(copy.a11y.landing.path, { counted: COUNTED })} focusable="false">
      <path
        d="M336 70 C 200 60, 60 56, 38 118 C 26 160, 330 146, 330 190 C 330 226, 110 222, 30 226"
        fill="none"
        stroke="#FAF8F4"
        strokeWidth="16"
        strokeLinecap="round"
      />
      {POINTS.map(([x, y], i) => {
        const f = FILLS[i];
        const today = i === TODAY;
        const id = `${uid}-c${i}`;
        return (
          <g key={i} transform={`translate(${x - 20} ${y - 30})`}>
            <g transform="translate(6 0) scale(0.7 0.7083)">
              <clipPath id={id}>
                <path d="M5 4 L35 4 L31 44 L9 44 Z" />
              </clipPath>
              <path d="M5 4 L35 4 L31 44 L9 44 Z" fill="rgba(255,255,255,0.7)" />
              <g clipPath={`url(#${id})`}>
                <g transform={`translate(0 ${f ? (44 - f * 40).toFixed(1) : 60})`}>
                  <path className="pub-wv" d="M-40 0 Q-30 -4 -20 0 T0 0 T20 0 T40 0 T60 0 V60 H-40 Z" fill="#6F8A6E" />
                </g>
              </g>
              <path
                d="M5 4 L35 4 L31 44 L9 44 Z"
                fill="none"
                stroke="#123021"
                strokeWidth="2.6"
                strokeLinejoin="round"
                strokeDasharray={f ? undefined : "3.5 3"}
              />
            </g>
            {today ? <ellipse className="pub-glow" cx="20" cy="36" rx="19" ry="6.5" fill="none" stroke="#BB6F51" strokeWidth="3" /> : null}
            <ellipse
              cx="20"
              cy="36"
              rx="19"
              ry="6.5"
              fill={today ? "#BB6F51" : f ? "#D9C7B8" : "#FAF8F4"}
              stroke={today ? "#8A4A33" : "#6B4B45"}
              strokeWidth="2"
              strokeDasharray={f || today ? undefined : "4 3"}
            />
            {LIVE_STONES.has(i) ? (
              <text x="20" y="58" textAnchor="middle" fontSize="11" fontWeight="700" fill="#8A4A33" fontFamily="inherit">
                {copy.path.liveTag}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function LandingRing() {
  return (
    <svg width="116" height="116" viewBox="0 0 100 100" role="img" aria-label={fill(copy.a11y.ring, { n: COUNTED })} focusable="false">
      <circle cx="50" cy="50" r="42" fill="none" stroke="#F0E8E1" strokeWidth="10" />
      <circle className="pub-ring" cx="50" cy="50" r="42" fill="none" stroke="#BB6F51" strokeWidth="10" strokeLinecap="round" strokeDasharray="264" strokeDashoffset="188.6" transform="rotate(-90 50 50)" />
      <text x="50" y="52" textAnchor="middle" fontWeight="900" fontSize="30" fill="#2E0808" fontFamily="inherit">{COUNTED}</text>
      <text x="50" y="68" textAnchor="middle" fontWeight="500" fontSize="10" fill="#6B4B45" fontFamily="inherit">{copy.common.countOfTotal.replace("{n}", "").trim()}</text>
    </svg>
  );
}

export function LandingCup() {
  const id = `${useId().replace(/:/g, "")}-big`;
  return (
    <svg width="86" height="104" viewBox="0 0 80 96" role="img" aria-label={copy.a11y.cup.one} focusable="false">
      <clipPath id={id}>
        <path d="M8 6 L72 6 L64 90 L16 90 Z" />
      </clipPath>
      <path d="M8 6 L72 6 L64 90 L16 90 Z" fill="rgba(255,255,255,0.55)" />
      <g clipPath={`url(#${id})`}>
        <g transform="translate(0 48)">
          <path className="pub-wv" d="M-40 0 Q-30 -5 -20 0 T0 0 T20 0 T40 0 T60 0 T80 0 T100 0 V60 H-40 Z" fill="#123021" />
        </g>
      </g>
      <path d="M16 14 L21 80" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="3" strokeLinecap="round" />
      <path d="M8 6 L72 6 L64 90 L16 90 Z" fill="none" stroke="#123021" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}
