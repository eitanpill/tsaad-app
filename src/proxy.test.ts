import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

const csp = async (path: string) =>
  (await proxy(new NextRequest(`https://app.example.test${path}`))).headers.get("Content-Security-Policy") ?? "";

afterEach(() => vi.unstubAllEnvs());

describe("proxy CSP and the Meta pixel", () => {
  it("no pixel id: no Meta host anywhere, also on the sales page", async () => {
    vi.stubEnv("META_PIXEL_ID", "");
    expect(await csp("/tsaad")).not.toContain("facebook");
  });
  it("with a valid id: Meta hosts on /tsaad only", async () => {
    vi.stubEnv("META_PIXEL_ID", "123456789012");
    expect(await csp("/tsaad")).toContain("https://connect.facebook.net");
    for (const p of ["/today", "/login", "/legal/privacy", "/"]) expect(await csp(p)).not.toContain("facebook");
  });
  it("an invalid id never opens the CSP", async () => {
    vi.stubEnv("META_PIXEL_ID", "abc https://evil.test");
    expect(await csp("/tsaad")).not.toContain("facebook");
    expect(await csp("/tsaad")).not.toContain("evil");
  });
});
