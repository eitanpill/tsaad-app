import type { Metadata } from "next";
import { Noto_Sans_Hebrew, Rubik } from "next/font/google";
import "./globals.css";

const notoHebrew = Noto_Sans_Hebrew({
  weight: ["700", "800", "900"],
  subsets: ["hebrew"],
  variable: "--font-heading",
});

const rubik = Rubik({
  weight: ["400", "500", "700"],
  subsets: ["hebrew", "latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "צעד קטן ביום",
  description: "אתגר 14 ימים של YOGIT",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${notoHebrew.variable} ${rubik.variable}`}>
      <body>{children}</body>
    </html>
  );
}
