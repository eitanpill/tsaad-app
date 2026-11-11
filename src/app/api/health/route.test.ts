// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/health", async (orig) => ({ ...(await orig<object>()), checkDb: h.check }));

import { GET } from "./route";

describe("GET /api/health", () => {
  it("answers only { ok, db }, and concurrent requests share one database probe (no load amplification)", async () => {
    let release!: (v: boolean) => void;
    h.check.mockImplementation(() => new Promise<boolean>((r) => (release = r)));
    const all = Promise.all(Array.from({ length: 20 }, () => GET()));
    await new Promise((r) => setTimeout(r, 0));
    release(true);
    const res = await all;
    expect(h.check).toHaveBeenCalledTimes(1);
    for (const r of res) {
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(await r.json()).toEqual({ ok: true, db: true });
    }
    // within the TTL the cached answer is reused
    await GET();
    expect(h.check).toHaveBeenCalledTimes(1);
  });
});
