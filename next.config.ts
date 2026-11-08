import type { NextConfig } from "next";
import { API_CSP, BUNNY_EMBED_ORIGIN } from "./src/lib/security/csp";

const isDev = process.env.NODE_ENV !== "production";

// ה־Content-Security-Policy של הדפים נקבע לכל בקשה ב־src/proxy.ts (עם nonce). כאן רק ל־route handlers.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), fullscreen=(self "${BUNNY_EMBED_ORIGIN}"), autoplay=(self "${BUNNY_EMBED_ORIGIN}")`,
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // route handlers אינם עוברים ב־proxy (ראו matcher שם): CSP קשיחה קבועה.
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: API_CSP }] },
      // Auth pages: /activate carries a one-time token in its URL. No Referer to other
      // sites, as an HTTP header too (the layout also sets <meta name="referrer">).
      // Not no-referrer: that makes form posts without JS send "Origin: null". Last match wins.
      {
        source: "/:page(login|activate|forgot)",
        headers: [{ key: "Referrer-Policy", value: "same-origin" }],
      },
    ];
  },
};

export default nextConfig;
