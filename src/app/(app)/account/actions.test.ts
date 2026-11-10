// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  headers: new Map<string, string>(),
  session: vi.fn(),
  core: vi.fn(),
  clear: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => h.headers.get(k.toLowerCase()) ?? null }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/auth/dal", () => ({ verifySession: h.session }));
vi.mock("@/lib/account/delete", () => ({ deleteAccountCore: h.core }));
vi.mock("@/lib/auth/cookies", () => ({ clearSessionCookie: h.clear }));
vi.mock("@/lib/auth/config", async (orig) => ({ ...(await orig<object>()), getSessionSecret: () => "s".repeat(40), getAppOrigin: () => "https://app.example.test" }));

import { deleteAccountAction } from "./actions";

const form = (pw: string) => {
  const f = new FormData();
  f.set("password", pw);
  return f;
};

describe("deleteAccountAction", () => {
  beforeEach(() => {
    h.headers.clear();
    h.headers.set("origin", "https://app.example.test");
    h.session.mockReset().mockResolvedValue({ userId: "u1", username: "a", displayName: "a" });
    h.core.mockReset();
    h.clear.mockReset();
  });

  it("rejects a cross-origin request before touching anything", async () => {
    h.headers.set("origin", "https://evil.example.test");
    await expect(deleteAccountAction({}, form("pw"))).rejects.toThrow(/Cross-origin/);
    expect(h.core).not.toHaveBeenCalled();
  });
  it("redirects to login without a session", async () => {
    h.session.mockResolvedValue(null);
    await expect(deleteAccountAction({}, form("pw"))).rejects.toThrow("REDIRECT:/login");
    expect(h.core).not.toHaveBeenCalled();
  });
  it("requires a password", async () => {
    expect(await deleteAccountAction({}, form(""))).toEqual({ error: "required" });
    expect(h.core).not.toHaveBeenCalled();
  });
  it("uses the session's user id, never one from the form", async () => {
    h.core.mockResolvedValue({ ok: false, reason: "invalid_password" });
    const f = form("pw");
    f.set("userId", "someone-else");
    expect(await deleteAccountAction({}, f)).toEqual({ error: "invalid" });
    expect(h.core.mock.calls[0][1].userId).toBe("u1");
  });
  it("maps rate limiting and unexpected failures", async () => {
    h.core.mockResolvedValue({ ok: false, reason: "rate_limited", retryAfterSeconds: 5 });
    expect(await deleteAccountAction({}, form("pw"))).toEqual({ error: "tooMany" });
    h.core.mockRejectedValue(new Error("db down"));
    expect(await deleteAccountAction({}, form("pw"))).toEqual({ error: "generic" });
    expect(h.clear).not.toHaveBeenCalled();
  });
  it("on success clears the cookie and goes to the confirmation page", async () => {
    h.core.mockResolvedValue({ ok: true, ghlContactId: "g1" });
    await expect(deleteAccountAction({}, form("pw"))).rejects.toThrow("REDIRECT:/account/deleted");
    expect(h.clear).toHaveBeenCalledOnce();
  });
});
