// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const core = vi.hoisted(() => vi.fn());
const rate = vi.hoisted(() => vi.fn());
const hdrs = vi.hoisted(() => ({ h: new Map<string, string>() }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => hdrs.h.get(k) ?? null }) }));
vi.mock("@/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/auth/dal", () => ({
  requireUser: async () => {
    if (!hdrs.h.has("cookie")) throw new Error("REDIRECT:/login");
    return { userId: "u1", username: "a", displayName: "a" };
  },
}));
vi.mock("@/lib/today/toggle", () => ({ toggleActionCore: core, toggleRateAllowed: rate }));
vi.mock("@/lib/auth/config", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/config")>()),
  getSessionSecret: () => "s".repeat(32),
}));
vi.mock("@/lib/preview/context", () => ({ getAppClock: async () => ({ now: new Date("2026-12-04T12:00:00Z"), schedule: null, previewDay: null }) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { toggleAction } from "./actions";

describe("toggleAction (server action wrapper)", () => {
  beforeEach(() => {
    core.mockReset();
    rate.mockReset();
    rate.mockResolvedValue(true);
    hdrs.h.clear();
    vi.stubEnv("APP_ORIGIN", "http://localhost:3100");
  });

  it("rejects a foreign Origin before touching anything", async () => {
    hdrs.h.set("origin", "https://evil.example");
    hdrs.h.set("cookie", "x");
    expect(await toggleAction(4, "habit")).toEqual({ ok: false, error: "forbidden" });
    expect(core).not.toHaveBeenCalled();
  });

  it("rejects a missing Origin and Referer", async () => {
    hdrs.h.set("cookie", "x");
    expect(await toggleAction(4, "habit")).toEqual({ ok: false, error: "forbidden" });
    expect(core).not.toHaveBeenCalled();
  });

  it("requires a session (redirects) after the origin check", async () => {
    hdrs.h.set("origin", "http://localhost:3100");
    await expect(toggleAction(4, "habit")).rejects.toThrow("REDIRECT:/login");
    expect(core).not.toHaveBeenCalled();
  });

  it("uses the session user, never one from the client, and passes the server clock", async () => {
    hdrs.h.set("origin", "http://localhost:3100");
    hdrs.h.set("cookie", "x");
    core.mockResolvedValue({ ok: true, day: 4, action: "habit", done: true, steps: 1, changed: true });
    await toggleAction(4, "habit", true);
    expect(core.mock.calls[0][1]).toMatchObject({
      userId: "u1",
      day: 4,
      action: "habit",
      desired: true,
      now: new Date("2026-12-04T12:00:00Z"),
    });
  });

  it("turns an unexpected failure into a quiet error result", async () => {
    hdrs.h.set("origin", "http://localhost:3100");
    hdrs.h.set("cookie", "x");
    core.mockRejectedValue(new Error("db down"));
    expect(await toggleAction(4, "habit")).toEqual({ ok: false, error: "failed" });
  });

  it("checks the per-user rate cap with the session user, and refuses without writing when over it", async () => {
    hdrs.h.set("origin", "http://localhost:3100");
    hdrs.h.set("cookie", "x");
    rate.mockResolvedValue(false);
    expect(await toggleAction(4, "habit", true)).toEqual({ ok: false, error: "rate_limited" });
    expect(rate.mock.calls[0][2]).toBe("u1");
    expect(core).not.toHaveBeenCalled();
  });

  it("ignores a non-boolean desired value", async () => {
    hdrs.h.set("origin", "http://localhost:3100");
    hdrs.h.set("cookie", "x");
    core.mockResolvedValue({ ok: true });
    await toggleAction(4, "habit", "yes" as never);
    expect(core.mock.calls[0][1].desired).toBeUndefined();
  });
});
