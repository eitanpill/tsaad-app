import Image from "next/image";
import type { ReactNode } from "react";
import type { AvitalSlot } from "@/content/photos";
import { avitalPhoto } from "@/lib/photos/avital";

const SIZES: Record<AvitalSlot, string> = {
  about: "(min-width: 640px) 320px, 80vw",
  live: "72px",
};

/**
 * Avital's photo for a slot. Renders nothing while the slot is off (see src/content/photos.ts).
 * The box takes its size from the ratio (aspect-ratio in CSS), the image fills it: no layout shift, no stretching.
 * `priority` only for the one above the fold (passed to next/image as `preload`; its own `priority` prop is deprecated in Next 16).
 */
export function AvitalPhoto({ slot, variant, priority = false }: { slot: AvitalSlot; variant: "tile" | "round"; priority?: boolean }) {
  const p = avitalPhoto(slot);
  if (!p) return null;
  return (
    <span className={`av-photo av-photo--${variant}`} style={{ aspectRatio: String(p.ratio) }} data-slot={slot}>
      <Image src={p.src} alt={p.alt} fill sizes={SIZES[slot]} preload={priority} className="av-img" />
    </span>
  );
}

/** A tile's tag with the round photo beside it; with no photo, just the tag (the current design). */
export function WithRoundPhoto({ tag, slot, priority = false }: { tag: ReactNode; slot: AvitalSlot; priority?: boolean }) {
  if (!avitalPhoto(slot)) return <>{tag}</>;
  return (
    <div className="av-head">
      {tag}
      <AvitalPhoto slot={slot} variant="round" priority={priority} />
    </div>
  );
}
