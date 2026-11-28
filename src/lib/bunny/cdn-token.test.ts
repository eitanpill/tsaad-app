// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildBunnyCdnUrl, bunnyCdnToken } from "./cdn-token";

describe("Bunny CDN token", () => {
  it("is url-safe base64 of sha256(key + path + expires), no padding", () => {
    const raw = createHash("sha256").update("k/med/d1.mp3100").digest("base64");
    const t = bunnyCdnToken({ tokenKey: "k", path: "/med/d1.mp3", expires: 100 });
    expect(t).toBe(raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    expect(t).not.toMatch(/[+/=]/);
  });
  it("signs for two hours with a key and returns a plain url without one", () => {
    const now = new Date(1_000_000_000);
    const signed = buildBunnyCdnUrl({ host: "a.b-cdn.net", file: "med/d1.mp3", tokenKey: "k", now });
    expect(signed).toMatch(/^https:\/\/a\.b-cdn\.net\/med\/d1\.mp3\?token=[A-Za-z0-9_-]+&expires=1007200$/);
    expect(buildBunnyCdnUrl({ host: "a.b-cdn.net", file: "d1.mp3", now })).toBe("https://a.b-cdn.net/d1.mp3");
  });
  it("rejects bad hosts and paths", () => {
    const now = new Date();
    expect(() => buildBunnyCdnUrl({ host: "evil.com", file: "a.mp3", now })).toThrow();
    for (const f of ["../a.mp3", "/a.mp3", "a//b.mp3", "a?.mp3"]) expect(() => buildBunnyCdnUrl({ host: "a.b-cdn.net", file: f, now })).toThrow();
  });
});
