// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieValue = vi.hoisted(() => ({ v: undefined as string | undefined }));
const validate = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieValue.v ? { value: cookieValue.v } : undefined) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
vi.mock("@/db", () => ({ getDb: () => ({}) }));
vi.mock("./session", () => ({ validateSession: validate }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { requireUser, verifySession } from "./dal";

describe("data access layer", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    validate.mockReset();
    cookieValue.v = undefined;
    vi.stubEnv("SESSION_SECRET", "s".repeat(32));
  });

  it("returns null without a cookie, and never queries the database", async () => {
    expect(await verifySession()).toBeNull();
    expect(validate).not.toHaveBeenCalled();
  });

  it("returns the narrow user for a valid session", async () => {
    cookieValue.v = "tok";
    validate.mockResolvedValue({ sessionId: "s", userId: "u1", username: "noa", displayName: "נועה" });
    expect(await verifySession()).toEqual({ userId: "u1", username: "noa", displayName: "נועה" });
  });

  it("returns null for an unknown or expired session", async () => {
    cookieValue.v = "tok";
    validate.mockResolvedValue(null);
    expect(await verifySession()).toBeNull();
  });

  it("fails closed when SESSION_SECRET is missing or short, even with a valid session", async () => {
    cookieValue.v = "tok";
    validate.mockResolvedValue({ sessionId: "s", userId: "u1", username: "noa", displayName: "x" });
    vi.stubEnv("SESSION_SECRET", "short");
    expect(await verifySession()).toBeNull();
    vi.stubEnv("SESSION_SECRET", "");
    expect(await verifySession()).toBeNull();
  });

  it("requireUser redirects to /login when there is no session", async () => {
    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
  });
});
