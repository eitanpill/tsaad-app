import { readEnv } from "@/config";
import { testClockAllowed } from "@/lib/today/test-clock";
import { AVITAL_DIR, AVITAL_PHOTOS, type AvitalSlot } from "@/content/photos";

export type ResolvedPhoto = { src: string; ratio: number; alt: string };

/**
 * The photo to show in a slot, or null (render nothing: the current design). Decided on the server from the manifest.
 * E2E only: TSAAD_E2E_PHOTOS=1 turns every slot on with a generated fixture (public/avital/e2e-<slot>.png, git-ignored),
 * and only where the test clock is allowed (never on Vercel, never in a real production deploy).
 */
export function avitalPhoto(slot: AvitalSlot, env: Record<string, string | undefined> = readEnv()): ResolvedPhoto | null {
  const p = AVITAL_PHOTOS[slot];
  if (p.present) return { src: `${AVITAL_DIR}/${p.file}`, ratio: p.ratio, alt: p.alt };
  if (env.TSAAD_E2E_PHOTOS === "1" && testClockAllowed(env)) {
    return { src: `${AVITAL_DIR}/e2e-${slot}.png`, ratio: p.ratio, alt: p.alt };
  }
  return null;
}
