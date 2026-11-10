import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeSubscription, fakeVapidPublicKey } from "../../../test/push-keys";
import { detectStatus, disableReminders, enableReminders, pushSupported, urlBase64ToUint8Array } from "./push-client";

const VAPID = fakeVapidPublicKey();

type FakeSub = { endpoint: string; toJSON: () => unknown; unsubscribe: () => Promise<boolean> };
function install(opts: { permission?: NotificationPermission; request?: NotificationPermission; existing?: boolean; fetchOk?: boolean; withPush?: boolean }) {
  const s = fakeSubscription();
  let sub: FakeSub | null = opts.existing ? mk() : null;
  function mk(): FakeSub {
    return { endpoint: s.endpoint, toJSON: () => s, unsubscribe: vi.fn(async () => ((sub = null), true)) };
  }
  const pushManager = {
    getSubscription: async () => sub,
    subscribe: vi.fn(async () => (sub = mk())),
  };
  const reg = { pushManager };
  vi.stubGlobal("Notification", { permission: opts.permission ?? "default", requestPermission: vi.fn(async () => opts.request ?? "granted") });
  if (opts.withPush !== false) vi.stubGlobal("PushManager", class {});
  else vi.stubGlobal("PushManager", undefined);
  if (opts.withPush === false) delete (window as unknown as Record<string, unknown>).PushManager;
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { getRegistration: async () => reg, register: vi.fn(), ready: Promise.resolve(reg) },
  });
  const fetchMock = vi.fn(async () => new Response(null, { status: opts.fetchOk === false ? 500 : 201 }));
  vi.stubGlobal("fetch", fetchMock);
  return { pushManager, fetchMock, getSub: () => sub, s };
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("urlBase64ToUint8Array", () => {
  it("decodes a base64url VAPID key to its 65 raw bytes", () => {
    const out = urlBase64ToUint8Array(VAPID);
    expect(out).toHaveLength(65);
    expect(out[0]).toBe(4);
    expect(Buffer.from(out).toString("base64url")).toBe(VAPID);
  });
  it("handles missing padding and the url alphabet", () => {
    expect([...urlBase64ToUint8Array("-_8")]).toEqual([251, 255]);
  });
});

describe("detectStatus", () => {
  it("is unsupported without a server key, or without the APIs", async () => {
    install({});
    expect(await detectStatus(null)).toBe("unsupported");
    install({ withPush: false });
    expect(pushSupported()).toBe(false);
    expect(await detectStatus(VAPID)).toBe("unsupported");
  });
  it("maps permission and subscription to blocked / off / on", async () => {
    install({ permission: "denied" });
    expect(await detectStatus(VAPID)).toBe("blocked");
    install({ permission: "default" });
    expect(await detectStatus(VAPID)).toBe("off");
    install({ permission: "granted" });
    expect(await detectStatus(VAPID)).toBe("off");
    install({ permission: "granted", existing: true });
    expect(await detectStatus(VAPID)).toBe("on");
  });
});

describe("enableReminders", () => {
  it("subscribes with userVisibleOnly and the server key, then registers with the server", async () => {
    const t = install({});
    expect(await enableReminders(VAPID)).toBe("on");
    expect(t.pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(t.fetchMock).toHaveBeenCalledWith("/api/push", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse((t.fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body).toEqual(t.s);
  });
  it("reports blocked when permission is denied, and off when the prompt is dismissed", async () => {
    install({ request: "denied" });
    expect(await enableReminders(VAPID)).toBe("blocked");
    const t = install({ request: "default" });
    expect(await enableReminders(VAPID)).toBe("off");
    expect(t.pushManager.subscribe).not.toHaveBeenCalled();
  });
  it("drops the local subscription and reports an error when the server refuses", async () => {
    const t = install({ fetchOk: false });
    expect(await enableReminders(VAPID)).toBe("error");
    expect(t.getSub()).toBeNull();
  });
});

describe("disableReminders", () => {
  it("deletes on the server first, then unsubscribes locally", async () => {
    const t = install({ existing: true });
    expect(await disableReminders()).toBe("off");
    expect(t.fetchMock).toHaveBeenCalledWith("/api/push", expect.objectContaining({ method: "DELETE" }));
    expect(t.getSub()).toBeNull();
  });
  it("keeps the subscription (and reports an error) if the server call fails", async () => {
    const t = install({ existing: true, fetchOk: false });
    expect(await disableReminders()).toBe("error");
    expect(t.getSub()).not.toBeNull();
  });
});
