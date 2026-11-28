// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSchedule } from "@/lib/days";

const verifySession = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ verifySession: () => verifySession() }));
vi.mock("@/lib/preview/context", () => ({
  getAppClock: async () => ({ now: new Date("2026-12-04T14:00:00+02:00"), schedule: makeSchedule("2026-12-01") }),
}));
vi.mock("@/lib/today/audio", async (orig) => {
  const real = await orig<typeof import("@/lib/today/audio")>();
  return { ...real, getAudioConfig: () => ({ host: "a.b-cdn.net", files: ["m/d1.mp3", undefined, "m/d3.mp3", "m/d4.mp3"], tokenKey: "k" }) };
});

import { GET } from "./route";

const call = (day: string) => GET(new Request(`http://x.test/api/audio/${day}`), { params: Promise.resolve({ day }) });

describe("GET /api/audio/[day]", () => {
  beforeEach(() => verifySession.mockResolvedValue({ userId: "u" }));

  it("redirects an open day to the signed Bunny file, no-store", async () => {
    const r = await call("4");
    expect(r.status).toBe(302);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("Location")).toMatch(/^https:\/\/a\.b-cdn\.net\/m\/d4\.mp3\?token=[A-Za-z0-9_-]+&expires=\d+$/);
  });
  it("401 without a session", async () => {
    verifySession.mockResolvedValue(null);
    expect((await call("4")).status).toBe(401);
  });
  it("403 for a day that has not opened, 404 with no recording, 400 for junk", async () => {
    expect((await call("5")).status).toBe(403);
    expect((await call("2")).status).toBe(404);
    for (const d of ["0", "15", "abc", "1.5"]) expect((await call(d)).status).toBe(400);
  });
});
