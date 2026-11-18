import type { SVGProps } from "react";
import { paint } from "@/components/paint";

/**
 * ציורי יד קטנים (קווים עגולים, לא סימטריים בכוונה), בסגנון הצליל של הלוגו: קו אחד חופשי.
 * כולם דקורטיביים (aria-hidden) ומשתמשים רק בצבעי המותג.
 */
type P = SVGProps<SVGSVGElement> & { size?: number };

const common = { "aria-hidden": true, focusable: "false", fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** שמש: עיגול פתוח (הקו נחתך בחפיפה) עם מילוי מוסט, וקרניים באורכים שונים. */
export function SunDoodle({ size = 72, ...p }: P) {
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} {...common} {...p}>
      <path d="M43 25 C 53 22 62 30 61 41 C 60 52 50 60 39 59 C 28 58 21 49 22 39 C 23 29 31 22 42 23 L 47 24" stroke="none" transform="translate(2 2)" style={paint("sand")} />
      <path d="M40 21 C 51 20 60 29 59 40 C 58 52 48 59 38 58 C 28 57 21 49 22 39 C 23 29 31 21 42 22 L 46 23.5" strokeWidth="3.4" style={paint(null, "terracotta")} />
      <path d="M40 5 L 41 12" strokeWidth="3.2" style={paint(null, "terracotta")} />
      <path d="M62 12 L 58 17.5" strokeWidth="3.2" style={paint(null, "terracotta")} />
      <path d="M75 38 L 67.5 39" strokeWidth="3.2" style={paint(null, "terracotta")} />
      <path d="M17 12 L 21.5 17" strokeWidth="3.2" style={paint(null, "terracotta")} />
      <path d="M5 40 L 12 40.5" strokeWidth="3.2" style={paint(null, "terracotta")} />
      <path d="M66 66 L 61 61.5" strokeWidth="3.2" style={paint(null, "terracotta")} />
    </svg>
  );
}

/** ענף עם עלים. */
export function SprigDoodle({ size = 64, ...p }: P) {
  return (
    <svg viewBox="0 0 64 80" width={size} height={(size * 80) / 64} {...common} {...p}>
      <path d="M30 76 C 28 58 31 40 36 8" strokeWidth="3" style={paint(null, "forest")} />
      <path d="M31 56 C 20 54 13 46 12 36 C 22 37 29 44 31 56 Z" strokeWidth="2.6" style={paint("olive", "forest")} />
      <path d="M33 44 C 45 42 52 34 53 24 C 42 25 35 32 33 44 Z" strokeWidth="2.6" style={paint("sage", "forest")} />
      <path d="M35 27 C 27 24 23 17 24 9 C 31 11 35 18 35 27 Z" strokeWidth="2.6" style={paint("olive", "forest")} />
    </svg>
  );
}

/** גבעות רכות ושמש, לרקע של אריח הסרטון כשאין עוד תמונה. */
export function MeadowDoodle({ ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 346 200" preserveAspectRatio="xMidYMid slice" {...common} {...p}>
      <rect width="346" height="200" stroke="none" style={paint("sky")} />
      <path d="M0 130 C 60 106 120 128 188 112 C 250 98 300 112 346 100 L346 200 L0 200 Z" stroke="none" style={paint("sage")} />
      <path d="M0 160 C 70 138 130 160 210 144 C 270 132 310 142 346 134 L346 200 L0 200 Z" stroke="none" style={paint("olive")} />
      <path d="M0 130 C 60 106 120 128 188 112 C 250 98 300 112 346 100" strokeWidth="2.4" opacity="0.55" style={paint(null, "forest")} />
      <g transform="translate(236 14)">
        <path d="M44 23 C 55 21 64 31 62 43 C 60 54 50 61 40 60 C 29 59 22 50 23 40 C 24 30 33 22 45 24" stroke="none" transform="translate(3 3)" style={paint("sand")} />
        <path d="M41 22 C 52 21 62 30 60 42 C 58 53 48 60 38 59 C 28 58 21 49 22 39 C 23 29 32 21 43 23 L 48 25" strokeWidth="3.4" style={paint(null, "terracotta")} />
        <path d="M41 5 L 42 12 M64 13 L 59 18 M77 40 L 69 41 M18 12 L 23 17 M5 41 L 13 41.5" strokeWidth="3.2" style={paint(null, "terracotta")} />
      </g>
      <g transform="translate(36 96) scale(0.9)">
        <path d="M30 76 C 28 58 31 40 36 8" strokeWidth="3" style={paint(null, "forest")} />
        <path d="M31 56 C 20 54 13 46 12 36 C 22 37 29 44 31 56 Z" strokeWidth="2.6" style={paint("cream", "forest")} />
        <path d="M33 44 C 45 42 52 34 53 24 C 42 25 35 32 33 44 Z" strokeWidth="2.6" style={paint("cream", "forest")} />
      </g>
    </svg>
  );
}

/** שביל מתפתל של אבנים, לצד המסכים הרחבים. */
export function PathDoodle({ ...p }: SVGProps<SVGSVGElement>) {
  const stones: Array<[number, number]> = [
    [300, 70], [248, 96], [196, 90], [146, 112], [104, 148], [126, 196], [176, 218],
    [228, 246], [262, 292], [222, 336], [168, 356], [112, 372], [84, 420], [130, 462],
  ];
  return (
    <svg viewBox="0 0 360 520" {...common} {...p}>
      <path d="M306 70 C 240 100, 190 70, 140 112 C 90 152, 110 200, 170 218 C 240 238, 290 270, 250 320 C 220 356, 120 340, 96 380 C 76 414, 90 450, 132 462" strokeWidth="22" opacity="0.9" style={paint(null, "cream")} />
      {stones.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <ellipse cx="0" cy="8" rx="19" ry="7" strokeWidth="2.4" style={paint(i < 4 ? "stone-done" : i === 4 ? "terracotta" : "cream", "muted")} strokeDasharray={i > 4 ? "5 4" : undefined} />
          <path d="M-11 -20 L11 -20 L8 4 L-8 4 Z" strokeWidth="2.4" strokeDasharray={i > 4 ? "4 3.5" : undefined} style={paint("white", "forest")} />
          {i < 4 ? <path d="M-9 -9 Q-4 -12 0 -9 T9 -9 L8 4 L-8 4 Z" stroke="none" style={paint("water")} /> : null}
        </g>
      ))}
      <g transform="translate(20 10) scale(1.1)">
        <path d="M43 25 C 53 22 62 30 61 41 C 60 52 50 60 39 59 C 28 58 21 49 22 39 C 23 29 31 22 42 23 L 47 24" stroke="none" transform="translate(2 2)" style={paint("sand")} />
        <path d="M40 21 C 51 20 60 29 59 40 C 58 52 48 59 38 58 C 28 57 21 49 22 39 C 23 29 31 21 42 22 L 46 23.5" strokeWidth="3.4" style={paint(null, "terracotta")} />
        <path d="M40 5 L 41 12 M62 12 L 58 17.5 M75 38 L 67.5 39 M17 12 L 21.5 17 M5 40 L 12 40.5" strokeWidth="3.2" style={paint(null, "terracotta")} />
      </g>
    </svg>
  );
}
