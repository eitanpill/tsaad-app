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

  it("the community link is the challenge WhatsApp group, without tracking parameters", () => {
    expect(SOCIAL_LINKS.community).toBe(COMMUNITY_GROUP_URL);
    const u = new URL(COMMUNITY_GROUP_URL);
    expect(u.hostname).toBe("chat.whatsapp.com");
    expect(u.search).toBe("");
  });
});
