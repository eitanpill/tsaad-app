import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { copy } from "@/content/copy.he";
import { daysFromMask } from "@/lib/path/finish";

/**
 * כרטיס השיתוף (PNG, 1080x1350): השביל של 14 האבנים עם הימים שנספרו, והשורה "השלמתי 14 ימים של צעד קטן ביום".
 * בלי שם ובלי נתונים אישיים: הכתובת נושאת רק מסכת ביטים של הימים (m), והיא נבנית ללא התחברות, ללא עוגיות וללא מעקב.
 * הגופנים נטענים מקבצים מקומיים (satori לא קורא woff2).
 */
const fontDir = path.join(process.cwd(), "src/assets/fonts");
let fonts: Promise<[Buffer, Buffer]> | null = null;
const loadFonts = () => (fonts ??= Promise.all([readFile(path.join(fontDir, "NotoSansHebrew-ExtraBold.ttf")), readFile(path.join(fontDir, "Rubik-Medium.ttf"))]));

/**
 * satori מסדר את המילים מימין לשמאל אבל מצייר את אותיות המילה העברית משמאל לימין, ולכן הופכים כאן את אותיות כל מילה עברית
 * (מספרים ולטינית נשארים כמו שהם). התוצאה בתמונה נראית ונקראת נכון.
 */
const flip = (t: string) => t.split(" ").map((w) => (/[\u0590-\u05FF]/.test(w) ? [...w].reverse().join("") : w)).join(" ");

const C = { cream: "#FAF8F4", sky: "#EDF5FD", sand: "#F0E8E1", sage: "#D2DCD1", terra: "#BB6F51", terraText: "#8A4A33", forest: "#123021", maroon: "#2E0808", muted: "#6B4B45" };

export async function GET(req: Request) {
  const days = daysFromMask(new URL(req.url).searchParams.get("m"));
  if (!days) return new Response("bad request", { status: 400, headers: { "cache-control": "no-store" } });
  const counted = new Set(days);
  const [noto, rubik] = await loadFonts();

  const stone = (d: number) => (
    <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 132 }}>
      <div
        style={{
          width: 100,
          height: counted.has(d) ? 100 : 46,
          marginTop: counted.has(d) ? 0 : 54,
          borderRadius: counted.has(d) ? 50 : 26,
          alignItems: "center",
          justifyContent: "center",
          display: "flex",
          background: counted.has(d) ? C.terra : C.cream,
          border: `5px ${counted.has(d) ? "solid" : "dashed"} ${counted.has(d) ? C.terraText : C.muted}`,
        }}
      >
        {counted.has(d) ? (
          <svg width="52" height="52" viewBox="0 0 14 14"><path d="M2.5 7.5 L5.8 10.5 L11.5 3.5" fill="none" stroke="#2E0808" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        ) : null}
      </div>
      <div style={{ display: "flex", marginTop: 10, fontSize: 30, color: counted.has(d) ? C.terraText : C.muted, fontFamily: "Card", fontWeight: 800 }}>{d}</div>
    </div>
  );
  const row = (from: number) => (
    <div style={{ display: "flex", flexDirection: "row-reverse", justifyContent: "center", alignItems: "flex-end", marginTop: 50 }}>
      {Array.from({ length: 7 }, (_, i) => stone(from + i))}
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1350, display: "flex", flexDirection: "column", background: C.cream, fontFamily: "Card", padding: 54 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: C.sky, borderRadius: 64, padding: "70px 50px 60px" }}>
          <svg width="190" height="190" viewBox="0 0 80 80" style={{ marginBottom: 30 }}>
            <path d="M43 25 C 53 22 62 30 61 41 C 60 52 50 60 39 59 C 28 58 21 49 22 39 C 23 29 31 22 42 23 L 47 24" fill="#F0E8E1" transform="translate(2 2)" />
            <path d="M40 21 C 51 20 60 29 59 40 C 58 52 48 59 38 58 C 28 57 21 49 22 39 C 23 29 31 21 42 22 L 46 23.5" fill="none" stroke="#BB6F51" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M40 5 L 41 12 M62 12 L 58 17.5 M75 38 L 67.5 39 M17 12 L 21.5 17 M5 40 L 12 40.5 M66 66 L 61 61.5" fill="none" stroke="#BB6F51" strokeWidth="3.2" strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", fontSize: 92, lineHeight: 1.1, fontWeight: 800, color: C.maroon, textAlign: "center" }}>{flip(copy.finish.shareText)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", background: C.sage, borderRadius: 64, marginTop: 28, padding: "30px 10px 70px" }}>
          {row(1)}
          {row(8)}
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "flex-end", justifyContent: "space-between", color: C.maroon, fontSize: 40, fontWeight: 800 }}>
          <div style={{ display: "flex" }}>{flip(copy.brand.name)}</div>
          <div style={{ display: "flex", color: C.muted }}>{`${flip(copy.brand.byline)} · YOGIT`}</div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: [
        { name: "Card", data: noto, weight: 800, style: "normal" },
        { name: "Card", data: rubik, weight: 800, style: "normal" },
      ],
      headers: { "cache-control": "public, max-age=86400, immutable" },
    },
  );
}
