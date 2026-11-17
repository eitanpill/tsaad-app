// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const hdrs = vi.hoisted(() => ({ h: new Map<string, string>() }));
const session = vi.hoisted(() => ({ user: null as { userId: string; username: string; displayName: string } | null }));
const limit = vi.hoisted(() => ({ allowed: true }));

vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => hdrs.h.get(k) ?? null }) }));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
vi.mock("@/lib/auth/dal", () => ({ verifySession: async () => session.user }));
vi.mock("@/db", () => ({ getDb: () => ({}) }));
vi.mock("@/config", () => ({ getConfig: () => ({ env: { ADMIN_USERNAMES: "pit,avital" } }), readEnv: () => process.env }));
vi.mock("@/lib/auth/rate-limit", () => ({
  rateLimitKeys: () => ({ identifierHash: "h", ipHash: null }),
  registerAttempt: async () => (limit.allowed ? { allowed: true } : { allowed: false, retryAfterSeconds: 5 }),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { adminGate } from "./guard";

describe("admin gate for server actions", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "s".repeat(32));
    vi.stubEnv("APP_ORIGIN", "https://app.example.test");
    hdrs.h = new Map([["origin", "https://app.example.test"]]);
    session.user = { userId: "u1", username: "pit", displayName: "פיט" };
    limit.allowed = true;
  });
  it("lets a listed admin from the app origin through", async () => {
    expect(await adminGate()).toEqual({ ok: true, actor: { userId: "u1", username: "pit" } });
  });
  it("rejects a cross-origin request, before looking at the session", async () => {
    hdrs.h = new Map([["origin", "https://evil.example"]]);
    expect(await adminGate()).toEqual({ ok: false, error: "forbidden" });
    hdrs.h = new Map([["sec-fetch-site", "cross-site"], ["origin", "https://app.example.test"]]);
    expect(await adminGate()).toEqual({ ok: false, error: "forbidden" });
    hdrs.h = new Map();
    expect(await adminGate()).toEqual({ ok: false, error: "forbidden" });
  });
  it("rejects logged-out users and users not in ADMIN_USERNAMES", async () => {
    session.user = null;
    expect(await adminGate()).toEqual({ ok: false, error: "forbidden" });
    session.user = { userId: "u2", username: "dana", displayName: "דנה" };
    expect(await adminGate()).toEqual({ ok: false, error: "forbidden" });
  });
  it("is case-insensitive on the username and rate limits", async () => {
    session.user = { userId: "u3", username: "Avital", displayName: "א" };
    expect((await adminGate()).ok).toBe(true);
    limit.allowed = false;
    expect(await adminGate()).toEqual({ ok: false, error: "tooMany" });
    expect((await adminGate({ rateLimit: false })).ok).toBe(true);
  });
});
