import type { MetadataRoute } from "next";
import { copy } from "@/content/copy.he";

/** צבעי המותג (globals.css): רקע קרם, ועוד ירוק יער לשורת המצב. start_url הוא מסך היום (שם מפנים ל־/login אם אין סשן). */
export const BRAND_BACKGROUND = "#FAF8F4";
export const BRAND_THEME = "#123021";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: copy.brand.name,
    short_name: copy.brand.name,
    description: copy.brand.tagline,
    lang: "he",
    dir: "rtl",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND_BACKGROUND,
    theme_color: BRAND_THEME,
    categories: ["health", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
