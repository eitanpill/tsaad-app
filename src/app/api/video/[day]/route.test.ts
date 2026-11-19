// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSchedule } from "@/lib/days";

const verifySession = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ verifySession: () => verifySession() }));
vi.mock("@/lib/preview/context", () => ({
  getAppClock: async () => ({ now: new Date("2026-12-04T14:00:00+02:00"), schedule: makeSchedule("2026-12-01") }),
}));
vi.mock("@/lib/today/video", async (orig) => {
  const real = await orig<typeof import("@/lib/today/video")>();
  return {
    ...real,
    getVideoConfig: () => ({
      libraryId: "lib1",
      tokenKey: "key",
      ids: ["l1", "l2", "l3", "l4"],
      shortIds: ["s1", undefined, "s3", "s4"],
    }),
  };
});

import { GET } from "./route";

const call = (day: string, qs = "") =>
  GET(new Request(`http://x.test/api/video/${day}${qs}`), { params: Promise.resolve({ day }) });

describe("GET /api/video/[day]", () => {
  beforeEach(() => verifySession.mockResolvedValue({ userId: "u" }));

  it("returns the long video by default and keeps no-store", async () => {
    const r = await call("4");
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(((await r.json()) as { url: string }).url).toContain("/l4?");
  });
  it("?v=short returns the short video", async () => {
    const r = await call("4", "?v=short");
    expect(((await r.json()) as { url: string }).url).toContain("/s4?");
  });
  it("any other v value is treated as long", async () => {
    for (const qs of ["?v=long", "?v=SHORT", "?v=", "?v=short2", "?v=1&v=short"]) {
      const r = await call("4", qs);
      expect(((await r.json()) as { url: string }).url).toContain("/l4?");
    }
  });
  it("short is 404 when that day has no short id", async () => {
    expect((await call("2", "?v=short")).status).toBe(404);
  });
  it("locked days return 403 for short too", async () => {
    expect((await call("9", "?v=short")).status).toBe(403);
  });
  it("requires a session", async () => {
    verifySession.mockResolvedValue(null);
    expect((await call("4", "?v=short")).status).toBe(401);
  });
});
