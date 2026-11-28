import { describe, expect, it } from "vitest";
import { buildCsp, newNonce } from "./csp";

describe("csp", () => {
  const prod = buildCsp("abc", { dev: false });
  it("scripts use the nonce, never unsafe-inline or unsafe-eval in production", () => {
    const script = /script-src ([^;]+)/.exec(prod)![1];
    expect(script).toBe("'self' 'nonce-abc' 'strict-dynamic'");
    expect(prod).toContain("upgrade-insecure-requests");
  });
  it("dev adds eval and websockets only", () => {
    const dev = buildCsp("abc", { dev: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("ws:");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });
  it("keeps the Bunny embed host, frames and plugins locked down", () => {
    expect(prod).toContain("frame-src https://iframe.mediadelivery.net");
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).not.toMatch(/style-src [^;]*unsafe-inline/);
  });
  it("img-src gets the Bunny thumbnail host only when a valid one is configured", () => {
    expect(/img-src ([^;]+)/.exec(prod)![1]).toBe("'self' data: blob:");
    const withHost = buildCsp("abc", { thumbHost: "vz-1a2b3c4d-5e6.b-cdn.net" });
    expect(/img-src ([^;]+)/.exec(withHost)![1]).toBe("'self' data: blob: https://vz-1a2b3c4d-5e6.b-cdn.net");
    for (const bad of ["evil.com", "x.b-cdn.net.evil.com", "a b.b-cdn.net", "*.b-cdn.net", "https://a.b-cdn.net"]) {
      expect(/img-src ([^;]+)/.exec(buildCsp("abc", { thumbHost: bad }))![1]).toBe("'self' data: blob:");
    }
    expect(withHost).toContain("connect-src 'self'");
  });
  it("allows the service worker and the manifest from the same origin only", () => {
    expect(prod).toContain("worker-src 'self'");
    expect(prod).toContain("manifest-src 'self'");
  });
  it("opens Meta hosts only when the pixel is on", () => {
    expect(prod).not.toContain("facebook");
    const px = buildCsp("abc", { metaPixel: true });
    expect(/script-src ([^;]+)/.exec(px)![1]).toBe("'self' 'nonce-abc' 'strict-dynamic' https://connect.facebook.net");
    expect(/img-src ([^;]+)/.exec(px)![1]).toBe("'self' data: blob: https://www.facebook.com");
    expect(/connect-src ([^;]+)/.exec(px)![1]).toBe("'self' https://www.facebook.com");
    expect(px).toContain("frame-src https://iframe.mediadelivery.net");
  });
  it("nonces are unique and base64", () => {
    const a = newNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(newNonce()).not.toBe(a);
  });

  it("media-src gets the meditation audio host only when a valid one is configured", () => {
    expect(/media-src ([^;]+)/.exec(prod)![1]).toBe("'self' blob:");
    expect(/media-src ([^;]+)/.exec(buildCsp("abc", { audioHost: "tsaad-audio.b-cdn.net" }))![1]).toBe("'self' blob: https://tsaad-audio.b-cdn.net");
    for (const bad of ["evil.com", "a.b-cdn.net.evil.com", "https://a.b-cdn.net"]) {
      expect(/media-src ([^;]+)/.exec(buildCsp("abc", { audioHost: bad }))![1]).toBe("'self' blob:");
    }
  });
});
