// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  headers: new Map<string, string>(),
  session: vi.fn(),
  rate: vi.fn(),
  set: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => h.headers.get(k.toLowerCase()) ?? null }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/auth/dal", () => ({ requireUser: async () => (await h.session()) ?? (() => { throw new Error("REDIRECT:/login"); })() }));
vi.mock("@/lib/today/toggle", () => ({ toggleRateAllowed: h.rate }));
vi.mock("@/lib/ghl/preferences", () => ({ setWhatsappReminderPref: h.set }));
vi.mock("@/lib/auth/config", async (orig) => ({ ...(await orig<object>()), getSessionSecret: () => "s".repeat(40), getAppOrigin: () => "https://app.example.test" }));

import { setWhatsappRemindersAction } from "./actions";

describe("setWhatsappRemindersAction", () => {
  beforeEach(() => {
    h.headers.clear();
    h.headers.set("origin", "https://app.example.test");
    h.session.mockReset().mockResolvedValue({ userId: "u1", username: "a", displayName: "a" });
    h.rate.mockReset().mockResolvedValue(true);
    h.set.mockReset().mockImplementation(async (_db, _id, on: boolean) => on);
  });

  it("refuses a cross-origin request without writing", async () => {
    h.headers.set("origin", "https://evil.example.test");
    expect(await setWhatsappRemindersAction(false)).toEqual({ ok: false });
    expect(h.set).not.toHaveBeenCalled();
  });
  it("redirects to login without a session", async () => {
    h.session.mockResolvedValue(null);
    await expect(setWhatsappRemindersAction(false)).rejects.toThrow("REDIRECT:/login");
    expect(h.set).not.toHaveBeenCalled();
  });
  it("saves for the session user only, with an explicit boolean", async () => {
    expect(await setWhatsappRemindersAction(false)).toEqual({ ok: true, on: false });
    expect(h.set).toHaveBeenCalledWith({}, "u1", false);
    expect(await setWhatsappRemindersAction("yes" as unknown as boolean)).toEqual({ ok: false });
    expect(h.set).toHaveBeenCalledTimes(1);
  });
  it("is rate limited per user, and a failure is generic", async () => {
    h.rate.mockResolvedValue(false);
    expect(await setWhatsappRemindersAction(true)).toEqual({ ok: false });
    h.rate.mockResolvedValue(true);
    h.set.mockRejectedValue(new Error("db down"));
    expect(await setWhatsappRemindersAction(true)).toEqual({ ok: false });
  });
});
