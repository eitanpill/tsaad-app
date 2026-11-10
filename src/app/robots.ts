import type { MetadataRoute } from "next";

/** robots.txt: הדפים הציבוריים (/tsaad ומידע משפטי) מותרים; האפליקציה, ההתחברות וה־API לא. אין sitemap (אין כתובת ציבורית מוגדרת בקוד). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/tsaad", "/legal"],
        disallow: [
          "/api/",
          "/login",
          "/activate",
          "/forgot",
          "/today",
          "/path",
          "/day/",
          "/live",
          "/reminders",
          "/install",
          "/offer",
          "/yesodot",
          "/account",
          "/admin/",
          "/go/",
        ],
      },
    ],
  };
}
