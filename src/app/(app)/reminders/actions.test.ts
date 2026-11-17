// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  headers: new Map<string, string>(),
  session: vi.fn(),
  rate: vi.fn(),
  set: vi.fn(),
  setTime: vi.fn(),
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
vi.mock("@/lib/ghl/preferences", () => ({ setWhatsappReminderPref: h.set, setReminderTime: h.setTime }));
vi.mock("@/lib/auth/config", async (orig) => ({ ...(await orig<object>()), getSessionSecret: () => "s".repeat(40), getAppOrigin: () => "https://app.example.test" }));

import { setReminderTimeAction, setWhatsappRemindersAction } from "./actions";

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

describe("setReminderTimeAction", () => {
  const form = (v?: string) => {
    const f = new FormData();
    if (v !== undefined) f.set("reminderTime", v);
    return f;
  };
  const idle = { status: "idle" } as const;
  beforeEach(() => {
    h.headers.clear();
    h.headers.set("origin", "https://app.example.test");
    h.session.mockReset().mockResolvedValue({ userId: "u1", username: "a", displayName: "a" });
    h.rate.mockReset().mockResolvedValue(true);
    h.setTime.mockReset().mockImplementation(async (_db, _id, m: number) => m);
  });

  it("refuses a cross-origin request without writing", async () => {
    h.headers.set("origin", "https://evil.example.test");
    expect(await setReminderTimeAction(idle, form("450"))).toEqual({ status: "error" });
    expect(h.setTime).not.toHaveBeenCalled();
  });
  it("redirects to login without a session", async () => {
    h.session.mockResolvedValue(null);
    await expect(setReminderTimeAction(idle, form("450"))).rejects.toThrow("REDIRECT:/login");
    expect(h.setTime).not.toHaveBeenCalled();
  });
  it("saves a valid choice for the session user only", async () => {
    expect(await setReminderTimeAction(idle, form("600"))).toEqual({ status: "saved", minutes: 600 });
    expect(h.setTime).toHaveBeenCalledWith({}, "u1", 600);
  });
  it("accepts the whole range 05:30..21:00 and nothing else", async () => {
    for (const ok of ["330", "360", "1260"]) expect((await setReminderTimeAction(idle, form(ok))).status).toBe("saved");
    h.setTime.mockClear();
    for (const bad of ["300", "329", "331", "345", "1290", "1261", "0", "-30", "450.5", "4e2", "abc", "", " 450", "0450", "99999"]) {
      expect(await setReminderTimeAction(idle, form(bad)), bad).toEqual({ status: "error" });
    }
    expect(await setReminderTimeAction(idle, form())).toEqual({ status: "error" });
    expect(h.setTime).not.toHaveBeenCalled();
  });
  it("is rate limited per user, and a DB failure or a missing user is a generic error", async () => {
    h.rate.mockResolvedValue(false);
    expect(await setReminderTimeAction(idle, form("450"))).toEqual({ status: "error" });
    h.rate.mockResolvedValue(true);
    h.setTime.mockResolvedValue(null);
    expect(await setReminderTimeAction(idle, form("450"))).toEqual({ status: "error" });
    h.setTime.mockRejectedValue(new Error("db down"));
    expect(await setReminderTimeAction(idle, form("450"))).toEqual({ status: "error" });
  });
});
