import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { connection } from "next/server";
import { PwaEarly } from "@/components/PwaEarly";

// One variable font (weights 100-900) for headings and body.
const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heading",
});

export const instant = false;

export const metadata: Metadata = {
  title: "צעד קטן ביום",
  description: "אתגר 14 ימים של YOGIT",
  // iOS: אייקון המסך הראשי ומצב אפליקציה (ה־manifest מגיע מ־app/manifest.ts).
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "צעד קטן ביום", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#1D3A2E" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable}`}>
      <body>
        {children}
        <PwaEarly />
      </body>
    </html>
  );
}
