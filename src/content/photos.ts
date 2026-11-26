/**
 * Photo slots for Avital (the teacher). The files do not exist yet: the owner sends them later.
 *
 * To turn a slot on: put the file at `public/avital/<file>` (sizes and ratios in docs/PHOTOS.md), then flip `present`
 * to true below. While `present` is false the slot renders nothing and the screen looks exactly as before.
 * `photos.test.ts` fails if a slot is on without its file, or if a file is too large.
 *
 * Local files only (CSP img-src 'self'); no remote hosts.
 */
export type AvitalSlot = "hero" | "about" | "live";

export type AvitalPhoto = {
  /** File name under public/avital/. */
  file: string;
  /** Required aspect ratio (width / height). The box is reserved from this, so nothing shifts when the image loads. */
  ratio: number;
  /** Source pixel size recommended (the minimum is half of it). */
  recommended: { width: number; height: number };
  /** Flip to true once the file is in public/avital/. */
  present: boolean;
  /** Neutral description of the photo (not decorative: it shows Avital). */
  alt: string;
};

export const AVITAL_PHOTOS: Record<AvitalSlot, AvitalPhoto> = {
  // Landing page (/tsaad), first photo, at the top beside the title. A yoga photo (Pit 2026-11-26: the first photo should feel like yoga).
  hero: {
    file: "avital-hero-pose.jpg",
    ratio: 4 / 5,
    recommended: { width: 1200, height: 1500 },
    present: true,
    alt: "אביטל פלס יושבת על סלע ליד הנחל בתנוחת יוגה",
  },
  // Landing page (/tsaad), second photo, in the "אביטל פלס" tile. A different photo: the portrait.
  about: {
    file: "avital-about-portrait.jpg",
    ratio: 4 / 5,
    recommended: { width: 1200, height: 1500 },
    present: true,
    alt: "אביטל פלס, מורת היוגה, עומדת בין העצים ומחייכת",
  },
  // /live hero tile and the opening-live card on the before-start screen.
  live: {
    file: "avital-live.jpg",
    ratio: 1,
    recommended: { width: 800, height: 800 },
    present: false,
    alt: "אביטל פלס, מורת היוגה",
  },
};

export const AVITAL_DIR = "/avital";
/** Hard cap per file (bytes); the target is 200 to 400 KB. */
export const AVITAL_MAX_BYTES = 500 * 1024;
