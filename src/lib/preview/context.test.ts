// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({ value: undefined as string | undefined }));
const session = vi.hoisted(() => ({ user: null as { userId: string; username: string; displayName: string } | null }));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (jar.value ? { value: jar.value } : undefined) }) }));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
vi.mock("@/lib/auth/dal", () => ({ verifySession: async () => session.user }));
vi.mock("@/lib/today/clock", () => ({ serverNow: async () => new Date("2026-11-11T10:00:00Z") }));
vi.mock("@/config", () => ({
  getConfig: () => ({ env: { ADMIN_USERNAMES: "pit, avital" }, timeZone: "Asia/Jerusalem", unlockTime: "05:00", startDate: undefined }),
  readEnv: () => process.env,
}));
vi.mock("@/lib/today/schedule", () => ({ getSchedule: () => null }));

import { dayStatusAt } from "@/lib/days";
import { signPreviewCookie } from "./cookie";
import { activePreviewDay, getAppClock } from "./context";

const SECRET = "p".repeat(32);

describe("preview context: admin gate and cookie are re-verified on every request", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    jar.value = undefined;
    session.user = null;
  });
  const cookieFor = (userId: string, day: number) => signPreviewCookie(SECRET, userId, day, Date.now()).value;

  it("is off without a cookie (virtual schedule is not used)", async () => {
    session.user = { userId: "u1", username: "pit", displayName: "פיט" };
    const c = await getAppClock();
    expect(c.previewDay).toBeNull();
    expect(c.schedule).toBeNull(); // START_DATE unset: the real, unstarted state
  });
  it("an admin with a valid cookie sees day N even with START_DATE unset", async () => {
    session.user = { userId: "u1", username: "Pit", displayName: "פיט" };
    jar.value = cookieFor("u1", 6);
    const c = await getAppClock();
    expect(c.previewDay).toBe(6);
    expect(dayStatusAt(c.now, c.schedule!)).toEqual({ phase: "active", day: 6 });
  });
  it("a non-admin is never affected, even with a correctly signed cookie", async () => {
    session.user = { userId: "u2", username: "dana", displayName: "דנה" };
    jar.value = cookieFor("u2", 6);
    expect(await activePreviewDay()).toBeNull();
    expect((await getAppClock()).schedule).toBeNull();
  });
  it("a logged-out request, a forged cookie and another admin's cookie are ignored", async () => {
    jar.value = cookieFor("u1", 6);
    expect(await activePreviewDay()).toBeNull(); // no session
    session.user = { userId: "u3", username: "avital", displayName: "אביטל" };
    expect(await activePreviewDay()).toBeNull(); // signed for u1
    jar.value = "v1.6.99999999999.deadbeef";
    expect(await activePreviewDay()).toBeNull();
  });
  it("fails closed without a valid SESSION_SECRET", async () => {
    session.user = { userId: "u1", username: "pit", displayName: "פיט" };
    jar.value = cookieFor("u1", 6);
    vi.stubEnv("SESSION_SECRET", "short");
    expect(await activePreviewDay()).toBeNull();
  });
});
