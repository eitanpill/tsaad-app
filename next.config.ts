import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy.
// - script-src 'unsafe-inline': the App Router streams inline <script> chunks
//   (self.__next_f). Moving to a per-request nonce (set in proxy.ts) is the
//   follow-up once pages are dynamic anyway (auth stage).
// - 'unsafe-eval' only in dev: React Refresh / Turbopack dev runtime needs it.
// - next/font self-hosts the font files at build time, so font-src 'self'.
// - frame-src: Bunny Stream player iframe (used in a later stage).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "media-src 'self' blob:",
  "frame-src https://iframe.mediadelivery.net",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), fullscreen=(self \"https://iframe.mediadelivery.net\"), autoplay=(self \"https://iframe.mediadelivery.net\")",
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
