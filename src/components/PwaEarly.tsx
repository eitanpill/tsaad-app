"use client";

// Side effect only: loading this module starts listening for beforeinstallprompt as soon as the client chunk runs,
// before hydration and on every page (including /login). See lib/pwa/install-prompt.ts.
import "@/lib/pwa/install-prompt";

export function PwaEarly() {
  return null;
}
