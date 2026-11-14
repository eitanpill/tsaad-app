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
vi.mock("@/lib/habits/checks", () => ({ toggleHabitCheckCore: core }));
vi.mock("@/lib/today/toggle", () => ({ toggleRateAllowed: rate }));
vi.mock("@/lib/auth/config", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/config")>()),
  getSessionSecret: () => "s".repeat(32),
}));
const preview = vi.hoisted(() => ({ day: null as number | null }));
vi.mock("@/lib/preview/context", () => ({
  getAppClock: async () => ({ now: new Date("2026-12-04T12:00:00Z"), schedule: null, previewDay: preview.day }),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { toggleHabit } from "./habit-actions";

describe("toggleHabit (server action wrapper)", () => {
  beforeEach(() => {
    core.mockReset();
    rate.mockReset();
    rate.mockResolvedValue(true);
    hdrs.h.clear();
    preview.day = null;
    vi.stubEnv("APP_ORIGIN", "http://localhost:3100");
  });
  const ok = () => {
    hdrs.h.set("origin", "http://localhost:3100");
    hdrs.h.set("cookie", "x");
  };

  it("rejects a foreign Origin before touching anything", async () => {
    hdrs.h.set("origin", "https://evil.example");
    hdrs.h.set("cookie", "x");
    expect(await toggleHabit(4, 2)).toEqual({ ok: false, error: "forbidden" });
    expect(core).not.toHaveBeenCalled();
  });

  it("requires a session after the origin check", async () => {
    hdrs.h.set("origin", "http://localhost:3100");
    await expect(toggleHabit(4, 2)).rejects.toThrow("REDIRECT:/login");
    expect(core).not.toHaveBeenCalled();
  });

  it("validates with zod: day 1..14 integer, habitDay 1..day", async () => {
    ok();
    for (const [d, h] of [[0, 1], [15, 1], [4, 0], [4, 5], [4, 1.5], [1.5, 1], [Number.NaN, 1]] as const) {
      expect(await toggleHabit(d, h)).toEqual({ ok: false, error: "invalid" });
    }
    expect(core).not.toHaveBeenCalled();
  });

  it("rate limit stops the call", async () => {
    ok();
    rate.mockResolvedValue(false);
    expect(await toggleHabit(4, 2)).toEqual({ ok: false, error: "rate_limited" });
    expect(core).not.toHaveBeenCalled();
  });

  it("uses the session user and server clock, never the client's", async () => {
    ok();
    core.mockResolvedValue({ ok: true, day: 4, habitDay: 2, checked: true, changed: true });
    expect(await toggleHabit(4, 2, true)).toMatchObject({ ok: true, checked: true });
    const a = core.mock.calls[0][1];
    expect(a).toMatchObject({ userId: "u1", day: 4, habitDay: 2, desired: true, syncTracker: true });
    expect(a.now).toEqual(new Date("2026-12-04T12:00:00Z"));
  });

  it("in an owner's preview the habit step is never queued for the tracker", async () => {
    ok();
    preview.day = 4;
    core.mockResolvedValue({ ok: true, day: 4, habitDay: 4, checked: true, changed: true });
    await toggleHabit(4, 4);
    expect(core.mock.calls[0][1].syncTracker).toBe(false);
  });

  it("a core failure becomes a generic error", async () => {
    ok();
    core.mockRejectedValue(new Error("db down"));
    expect(await toggleHabit(4, 2)).toEqual({ ok: false, error: "failed" });
  });
});
