import { describe, expect, it } from "vitest";
import { CLICK_LIMIT, ClickLimiter, isPrefetchOrBot } from "./click-limit";

const h = (o: Record<string, string>) => new Headers(o);
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";

describe("isPrefetchOrBot", () => {
  it("counts a normal browser click", () => {
    expect(isPrefetchOrBot(h({ "user-agent": UA }))).toBe(false);
  });
  it("skips prefetch and prerender requests", () => {
    expect(isPrefetchOrBot(h({ "user-agent": UA, purpose: "prefetch" }))).toBe(true);
    expect(isPrefetchOrBot(h({ "user-agent": UA, "sec-purpose": "prefetch;prerender" }))).toBe(true);
    expect(isPrefetchOrBot(h({ "user-agent": UA, "x-moz": "prefetch" }))).toBe(true);
    expect(isPrefetchOrBot(h({ "user-agent": UA, "next-router-prefetch": "1" }))).toBe(true);
  });
  it("skips bots, link previews and requests without a user agent", () => {
    expect(isPrefetchOrBot(h({}))).toBe(true);
    for (const ua of ["Googlebot/2.1", "WhatsApp/2.23", "facebookexternalhit/1.1", "curl/8.0", "TelegramBot (like TwitterBot)"]) {
      expect(isPrefetchOrBot(h({ "user-agent": ua })), ua).toBe(true);
    }
  });
});

describe("ClickLimiter", () => {
  it("allows a few counts per offer and IP in the window, then stops counting until it passes", () => {
    const l = new ClickLimiter();
    const t = 1_000_000;
    for (let i = 0; i < CLICK_LIMIT.perIp; i++) expect(l.allow("session", "1.2.3.4", t + i)).toBe(true);
    expect(l.allow("session", "1.2.3.4", t + 10)).toBe(false);
    expect(l.allow("bundle", "1.2.3.4", t + 10)).toBe(true);
    expect(l.allow("session", "5.6.7.8", t + 10)).toBe(true);
    expect(l.allow("session", "1.2.3.4", t + CLICK_LIMIT.windowMs + 5)).toBe(true);
  });
  it("without a trusted IP uses one ceiling per instance and offer", () => {
    const l = new ClickLimiter({ ...CLICK_LIMIT, perInstanceNoIp: 2 });
    expect(l.allow("session", null, 1)).toBe(true);
    expect(l.allow("session", null, 2)).toBe(true);
    expect(l.allow("session", null, 3)).toBe(false);
  });
  it("keeps memory bounded", () => {
    const l = new ClickLimiter({ ...CLICK_LIMIT, maxKeys: 50 });
    for (let i = 0; i < 500; i++) l.allow("session", `10.0.${i >> 8}.${i & 255}`, 1);
    expect((l as unknown as { hits: Map<string, number[]> }).hits.size).toBeLessThanOrEqual(50);
  });
});
