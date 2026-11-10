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
  it("allows the service worker and the manifest from the same origin only", () => {
    expect(prod).toContain("worker-src 'self'");
    expect(prod).toContain("manifest-src 'self'");
  });
  it("nonces are unique and base64", () => {
    const a = newNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(newNonce()).not.toBe(a);
  });
});
