import { describe, expect, it } from "vitest";
import { COMMUNITY_GROUP_URL } from "./social";
import { SOCIAL_LINKS, socialLinks } from "./landing-links";

describe("sales page links", () => {
  it("shows only links with an https URL, in page order", () => {
    expect(socialLinks({ linktree: null, media: "http://x.example", community: "https://chat.whatsapp.com/abc" })).toEqual([
      { key: "community", href: "https://chat.whatsapp.com/abc" },
    ]);
    expect(socialLinks({ linktree: "javascript:alert(1)", media: "not a url", community: null })).toEqual([]);
  });

  it("never links the paid participants' WhatsApp group from the public sales page", () => {
    expect(Object.values(SOCIAL_LINKS)).not.toContain(COMMUNITY_GROUP_URL);
    expect(Object.values(SOCIAL_LINKS).some((u) => u?.includes("chat.whatsapp.com"))).toBe(false);
  });
});
