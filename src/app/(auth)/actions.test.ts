// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  authenticate: vi.fn(),
  rotate: vi.fn(),
  peek: vi.fn(),
  setup: vi.fn(),
  clear: vi.fn(),
  setCookie: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => (k.toLowerCase() === "origin" ? "https://app.example.test" : null) }) }));
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("@/lib/messaging/sender", () => ({ getMessageSender: () => ({}) }));
vi.mock("@/lib/auth/config", async (orig) => ({
  ...(await orig<object>()),
  getSessionSecret: () => "s".repeat(40),
  getAppOrigin: () => "https://app.example.test",
  getActivationTtlMinutes: () => 30,
}));
vi.mock("@/lib/auth/login", () => ({ authenticate: h.authenticate, clearLoginLimitsForUser: h.clear }));
vi.mock("@/lib/auth/session", () => ({ rotateSession: h.rotate, deleteSession: vi.fn() }));
vi.mock("@/lib/auth/cookies", () => ({ readSessionToken: async () => undefined, setSessionCookie: h.setCookie, clearSessionCookie: vi.fn() }));
vi.mock("@/lib/auth/tokens", () => ({ peekToken: h.peek }));
vi.mock("@/lib/auth/accounts", () => ({ completePasswordSetup: h.setup }));
vi.mock("@/lib/push/subscription", () => ({ removeSubscriptionForSession: vi.fn() }));

import { activateAction, loginAction } from "./actions";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeEach(() => {
  for (const m of Object.values(h)) m.mockReset();
});

describe("loginAction", () => {
  const f = () => form({ username: "dana", password: "pass-12345" });

  it("a database failure while creating the session shows the friendly error, not a crash", async () => {
    h.authenticate.mockResolvedValue({ ok: true, userId: "u1" });
    h.rotate.mockRejectedValue(new Error("db down"));
    expect(await loginAction({}, f())).toEqual({ error: "generic", username: "dana" });
    expect(h.setCookie).not.toHaveBeenCalled();
  });
  it("a database failure while checking the password shows the friendly error", async () => {
    h.authenticate.mockRejectedValue(new Error("db down"));
    expect(await loginAction({}, f())).toEqual({ error: "generic", username: "dana" });
  });
  it("success redirects to Today", async () => {
    h.authenticate.mockResolvedValue({ ok: true, userId: "u1" });
    h.rotate.mockResolvedValue({ token: "t", expiresAt: new Date() });
    await expect(loginAction({}, f())).rejects.toThrow("REDIRECT:/today");
  });
  it("a locked username maps to tooMany", async () => {
    h.authenticate.mockResolvedValue({ ok: false, reason: "rate_limited" });
    expect(await loginAction({}, f())).toEqual({ error: "tooMany", username: "dana" });
  });
});

describe("activateAction (activation and reset links)", () => {
  const f = () => form({ token: "tok", password: "new-pass-12", confirm: "new-pass-12" });
  beforeEach(() => {
    h.peek.mockResolvedValue({ userId: "u1", username: "dana", displayName: "Dana", purpose: "reset" });
    h.setup.mockResolvedValue({ userId: "u1" });
  });

  it("a database failure while creating the session shows the friendly error, not a crash", async () => {
    h.rotate.mockRejectedValue(new Error("db down"));
    expect(await activateAction({}, f())).toEqual({ error: { field: "form", code: "generic" } });
  });
  it("a database failure before the password is saved shows the friendly error", async () => {
    h.peek.mockRejectedValue(new Error("db down"));
    expect(await activateAction({}, f())).toEqual({ error: { field: "form", code: "generic" } });
  });
  it("clears the login lockout of that user once the link proved ownership, then signs in", async () => {
    h.rotate.mockResolvedValue({ token: "t", expiresAt: new Date() });
    await expect(activateAction({}, f())).rejects.toThrow("REDIRECT:/today");
    expect(h.clear).toHaveBeenCalledTimes(1);
    expect(h.clear.mock.calls[0][1]).toBe("u1");
  });
  it("a failure to clear the lockout does not block the sign-in", async () => {
    h.clear.mockRejectedValue(new Error("db hiccup"));
    h.rotate.mockResolvedValue({ token: "t", expiresAt: new Date() });
    await expect(activateAction({}, f())).rejects.toThrow("REDIRECT:/today");
  });
});
