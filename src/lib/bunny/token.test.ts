// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildBunnyEmbedUrl, bunnyEmbedToken } from "./token";

const key = "test-key-not-real";
const video = "eb1c4f77-0cda-46be-b47d-1118ad7c2ffe";

describe("bunnyEmbedToken", () => {
  it("is sha256 hex of key + videoId + expires", () => {
    const expected = createHash("sha256").update(`${key}${video}1456761770`).digest("hex");
    expect(bunnyEmbedToken({ tokenKey: key, videoId: video, expires: 1456761770 })).toBe(expected);
    // fixed vector (computed independently with sha256sum)
    expect(expected).toBe("fa1273e82776b0dc34caeda0585809bd782cda0c6168f20da4f9393e1919b8a2");
  });
  it("rejects bad input", () => {
    expect(() => bunnyEmbedToken({ tokenKey: "", videoId: video, expires: 1 })).toThrow();
    expect(() => bunnyEmbedToken({ tokenKey: key, videoId: video, expires: 1.5 })).toThrow();
  });
});

describe("buildBunnyEmbedUrl", () => {
  const now = new Date("2026-12-01T03:00:00Z"); // 1795921200
  it("builds the iframe url with a 1h expiry by default", () => {
    const { url, expires } = buildBunnyEmbedUrl({ libraryId: "759", videoId: video, tokenKey: key, now });
    expect(expires).toBe(Math.floor(now.getTime() / 1000) + 3600);
    const u = new URL(url);
    expect(u.origin).toBe("https://iframe.mediadelivery.net");
    expect(u.pathname).toBe(`/embed/759/${video}`);
    expect(u.searchParams.get("expires")).toBe(String(expires));
    expect(u.searchParams.get("token")).toBe(bunnyEmbedToken({ tokenKey: key, videoId: video, expires }));
    expect(url).not.toContain(key);
  });
  it("honours ttl and rejects unsafe ids", () => {
    expect(buildBunnyEmbedUrl({ libraryId: "1", videoId: "v", tokenKey: key, now, ttlSeconds: 60 }).expires)
      .toBe(Math.floor(now.getTime() / 1000) + 60);
    expect(() => buildBunnyEmbedUrl({ libraryId: "1/../x", videoId: "v", tokenKey: key, now })).toThrow();
    expect(() => buildBunnyEmbedUrl({ libraryId: "1", videoId: "v?x=1", tokenKey: key, now })).toThrow();
    expect(() => buildBunnyEmbedUrl({ libraryId: "1", videoId: "v", tokenKey: key, now, ttlSeconds: 0 })).toThrow();
    expect(() => buildBunnyEmbedUrl({ libraryId: "1", videoId: "v", tokenKey: key, now, ttlSeconds: 6 * 3600 + 1 })).toThrow();
    expect(() => buildBunnyEmbedUrl({ libraryId: "1", videoId: "v", tokenKey: key, now: new Date("x") })).toThrow();
    expect(() => buildBunnyEmbedUrl({ libraryId: "1", videoId: "v", tokenKey: "", now })).toThrow();
  });
});
