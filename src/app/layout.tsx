import type { Metadata, Viewport } from "next";
import { Noto_Sans_Hebrew, Rubik } from "next/font/google";
import "./globals.css";
import { connection } from "next/server";
import { PwaEarly } from "@/components/PwaEarly";

// Variable fonts (no `weight` list): one file per subset instead of one per weight (3 files instead of 12).
// Weights used in the CSS: headings 700/800/900 (Noto Sans Hebrew), body 400/500/700 (Rubik).
const notoHebrew = Noto_Sans_Hebrew({
  subsets: ["hebrew"],
  variable: "--font-heading",
});

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  variable: "--font-body",
});

export const instant = false;

export const metadata: Metadata = {
  title: "צעד קטן ביום",
  description: "אתגר 14 ימים של YOGIT",
  // iOS: אייקון המסך הראשי ומצב אפליקציה (ה־manifest מגיע מ־app/manifest.ts).
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "צעד קטן ביום", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#123021" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  return (
    <html lang="he" dir="rtl" className={`${notoHebrew.variable} ${rubik.variable}`}>
      <body>
        {children}
        <PwaEarly />
      </body>
    </html>
  );
}
