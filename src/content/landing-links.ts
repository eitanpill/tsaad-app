/**
 * Links at the end of the sales page (/tsaad). One place for the URLs.
 *
 * TODO(Pit): fill in the Linktree and media URLs. Never put the challenge WhatsApp group here (Pit 2026-11-26: participants only). While a URL is null that link is not shown, and when all three are null the whole
 * "להמשיך להכיר" block is hidden, so the page never shows a link that goes nowhere.
 * Only https URLs; they open in the same tab.
 */
export type SocialKey = "linktree" | "media" | "community";

export const SOCIAL_LINKS: Record<SocialKey, string | null> = {
  // [LINKTREE_URL] e.g. https://linktr.ee/...
  linktree: null,
  // [MEDIA_URL] Avital in the media (press page, or a social profile: Pit to confirm which)
  media: null,
  // [COMMUNITY_URL] a PUBLIC community (not the challenge WhatsApp group: that one is only for paying participants, inside the app).
  community: null,
};

export const SOCIAL_ORDER: readonly SocialKey[] = ["linktree", "media", "community"];

/** The links that have a valid https URL, in page order. */
export function socialLinks(links: Record<SocialKey, string | null> = SOCIAL_LINKS): { key: SocialKey; href: string }[] {
  return SOCIAL_ORDER.flatMap((key) => {
    const href = links[key];
    if (!href) return [];
    try {
      return new URL(href).protocol === "https:" ? [{ key, href }] : [];
    } catch {
      return [];
    }
  });
}
