import Link from "next/link";
import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import type { Stone, StoneState } from "@/lib/path/view";
import { StoneCup } from "./StoneCup";

/**
 * מיקום כל אבן במפה (מערכת הקואורדינטות של הלוח: 366 על 474). x באחוזים מהרוחב, y בפיקסלים.
 * ביחס ללוח העיצוב, אבנים 5, 9, 13 ו־14 זזו עד 14 פיקסלים כדי ששטחי הלחיצה של אבנים סמוכות לא ייחתכו ב־320px.
 */
const POINTS: ReadonlyArray<readonly [number, number]> = [
  [282, 62], [212, 68], [143, 79], [79, 107], [65, 171], [133, 184], [201, 199],
  [267, 223], [294, 285], [230, 306], [162, 323], [94, 337], [58, 400], [117, 442],
];
const BOARD_W = 366;
const BOARD_H = 474;
const SHAPES = [
  "48% 52% 44% 56% / 58% 42% 58% 42%",
  "55% 45% 50% 50% / 45% 55% 45% 55%",
  "50% 50% 58% 42% / 52% 48% 52% 48%",
];
/** כל מה שפתוח ושלא נספר מציג כוס עם מתאר רציף; עוד לא נפתח מקווקו. */
const dashedFor = (s: StoneState) => s === "locked";

function stateLabel(s: Stone): string {
  return copy.path.stone[s.state];
}

function accessibleName(s: Stone): string {
  return fill(s.live ? copy.a11y.path.stoneLive : copy.a11y.path.stone, { n: s.day, state: stateLabel(s) });
}

function StoneBody({ stone }: { stone: Stone }) {
  const label = stone.live ? `${stone.day} · ${copy.path.liveTag}` : String(stone.day);
  return (
    <>
      <span className="visually-hidden">{accessibleName(stone)}</span>
      <span aria-hidden="true" className="stone-visual">
        <StoneCup fill={stone.fill} dashed={dashedFor(stone.state)} />
        {stone.state === "yesterday" ? <ClockBadge /> : null}
        <i className={`stone-rock stone-rock--${stone.state}`} style={{ borderRadius: SHAPES[(stone.day - 1) % 3] }} />
        {stone.state === "today" ? <span className="stone-tag">{copy.path.stone.today}</span> : null}
        <span className={`stone-num${stone.live || stone.state === "today" ? " stone-num--hi" : ""}`}>{label}</span>
      </span>
    </>
  );
}

/**
 * המפה: רשימה מסודרת של 14 אבנים על שביל מתפתל. אבן שנפתחה היא קישור ליום שלה (היום הנוכחי ל־/today);
 * אבן נעולה אינה קישור, חוץ מהיום שנפתח מחר, שיש לו מסך משלו. הרשימה נקראת כרשימה, עם סיכום טקסטואלי.
 */
export function PathMap({ stones, counted }: { stones: Stone[]; counted: number }) {
  return (
    <section className="t t-map" style={{ height: BOARD_H }}>
      <svg
        className="map-road"
        viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          transform="scale(1 1.13)"
          vectorEffect="non-scaling-stroke"
          d="M300 54 C 200 62, 90 60, 52 124 C 30 168, 250 160, 300 220 C 330 262, 160 286, 80 300 C 30 312, 60 380, 130 386"
          fill="none"
          stroke="#FAF8F4"
          strokeWidth="18"
          strokeLinecap="round"
        />
      </svg>
      <ol className="stones" role="list" aria-label={fill(copy.a11y.path.summary, { counted })}>
        {stones.map((stone) => {
          const [x, y] = POINTS[stone.day - 1];
          return (
            <li
              key={stone.day}
              className="stone"
              data-day={stone.day}
              data-state={stone.state}
              style={{ left: `${(x / BOARD_W) * 100}%`, top: y }}
            >
              {stone.href ? (
                <Link href={stone.href} className="stone-link" prefetch={false}>
                  <StoneBody stone={stone} />
                </Link>
              ) : (
                <span className="stone-link stone-link--plain">
                  <StoneBody stone={stone} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const LEGEND_TEXT: Record<StoneState, string> = {
  counted: copy.path.legend.counted,
  today: copy.path.legend.today,
  yesterday: copy.path.stone.yesterday,
  missed: copy.path.legend.missed,
  locked: copy.path.legend.locked,
};
const SWATCH_FILL: Record<StoneState, 0 | 0.5 | 1> = { counted: 1, today: 0.5, yesterday: 0, missed: 0, locked: 0 };

/**
 * מקרא. הסמלים דקורטיביים; המשמעות בטקסט. מציג רק מצבים שיש על השביל (ראו pathModel.legend),
 * כך שאחרי סוף האתגר אין בו "היום" ו"עוד לא נפתח".
 */
export function PathLegend({ states }: { states: readonly StoneState[] }) {
  const items: Array<{ key: string; text: string; glyph: React.ReactNode }> = [
    ...states.map((st) => ({
      key: st,
      text: LEGEND_TEXT[st],
      glyph: <Swatch fill={SWATCH_FILL[st]} state={st} dashed={st === "locked"} />,
    })),
    {
      key: "live",
      text: copy.path.legend.live,
      glyph: (
        <span className="legend-live">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <rect x="3" y="6" width="13" height="12" rx="3" />
            <path d="M16 10 L21 7 L21 17 L16 14 Z" />
          </svg>
        </span>
      ),
    },
  ];
  return (
    <section className="t t-legend">
      <ul>
        {items.map((i) => (
          <li key={i.key}>
            <span aria-hidden="true" className="legend-glyph">
              {i.glyph}
            </span>
            {i.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * סימן השעון של "אפשר לסמן עד חצות". בלעדיו אבן של אתמול נבדלת מ"לא נספר" רק בגוון (WCAG 1.4.1):
 * שתיהן כוס ריקה עם קו רציף.
 */
function ClockBadge({ small = false }: { small?: boolean }) {
  const size = small ? 12 : 16;
  return (
    <span className={`stone-badge${small ? " stone-badge--s" : ""}`}>
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="7" fill="#8A4A33" stroke="#FFFFFF" strokeWidth="1.5" />
        <path d="M8 4.2 V8 L10.6 9.6" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Swatch({ fill: f, state, dashed = false }: { fill: 0 | 0.5 | 1; state: StoneState; dashed?: boolean }) {
  return (
    <span className="swatch">
      <StoneCup fill={f} dashed={dashed} width={16} height={19} thick />
      <i className={`swatch-rock stone-rock--${state}`} />
      {state === "yesterday" ? <ClockBadge small /> : null}
    </span>
  );
}
