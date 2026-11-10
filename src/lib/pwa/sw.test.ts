// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * public/sw.js נטען ב־sandbox עם self, caches, clients ו־fetch מדומים. בודקים שהוא שומר רק נכסים סטטיים בלתי־משתנים,
 * ולעולם לא HTML, RSC, api או דבר אישי; שה־offline נענה מהמטמון הקבוע; ושההתראה ולחיצה עליה בטוחים.
 */
const SRC = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
const ORIGIN = "https://app.example.test";

type Handler = (e: Record<string, unknown>) => void;

function load() {
  const handlers: Record<string, Handler> = {};
  const stores = new Map<string, Map<string, Response>>();
  const putLog: string[] = [];
  const shown: Array<{ title: string; options: Record<string, unknown> }> = [];
  const opened: string[] = [];
  const fetched: string[] = [];
  let windows: Array<{ url: string; focus: () => Promise<void>; navigate: (u: string) => Promise<void>; navigated?: string; focused?: boolean }> = [];
  let online = true;
  let nextResponse: { status?: number; type?: string } = {};

  const cacheApi = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      addAll: async (urls: string[]) => urls.forEach((u) => m.set(new URL(u, ORIGIN).href, new Response("static"))),
      match: async (r: Request | string) => m.get(typeof r === "string" ? new URL(r, ORIGIN).href : r.url)?.clone(),
      put: async (r: Request, res: Response) => {
        putLog.push(r.url);
        m.set(r.url, res);
      },
      keys: async () => [...m.keys()].map((u) => new Request(u)),
      delete: async (r: Request) => m.delete(r.url),
    };
  };
  const caches = {
    open: async (n: string) => cacheApi(n),
    keys: async () => [...stores.keys()],
    delete: async (n: string) => stores.delete(n),
    match: async (r: Request | string, opts?: { cacheName?: string }) => {
      for (const [n, m] of stores) {
        if (opts?.cacheName && n !== opts.cacheName) continue;
        const hit = m.get(typeof r === "string" ? new URL(r, ORIGIN).href : r.url);
        if (hit) return hit.clone();
      }
      return undefined;
    },
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (t: string, h: Handler) => (handlers[t] = h),
    skipWaiting: async () => undefined,
    clients: {
      claim: async () => undefined,
      matchAll: async () => windows,
      openWindow: async (u: string) => void opened.push(u),
    },
    registration: { showNotification: async (title: string, options: Record<string, unknown>) => void shown.push({ title, options }) },
  };
  const fetchFn = async (req: Request) => {
    fetched.push(req.url);
    if (!online) throw new TypeError("offline");
    const res = new Response("net", { status: nextResponse.status ?? 200 });
    Object.defineProperty(res, "type", { value: nextResponse.type ?? "basic" }); // same-origin fetches are "basic"
    return res;
  };
  vm.runInNewContext(SRC, { self, caches, fetch: fetchFn, URL, Request, Response, console });

  const run = async (type: string, event: Record<string, unknown>) => {
    const waits: Promise<unknown>[] = [];
    handlers[type]({ ...event, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  const doFetch = async (url: string, init: { method?: string; mode?: string } = {}) => {
    const request = Object.assign(new Request(url, { method: init.method ?? "GET" }), {});
    Object.defineProperty(request, "mode", { value: init.mode ?? "no-cors" });
    let responded: Promise<Response> | undefined;
    handlers.fetch({ request, respondWith: (p: Promise<Response>) => (responded = p) });
    return responded ? await responded : undefined;
  };
  return {
    run,
    doFetch,
    putLog,
    shown,
    opened,
    fetched,
    stores,
    setOnline: (v: boolean) => (online = v),
    nextResponse: (r: { status?: number; type?: string }) => (nextResponse = r),
    setWindows: (w: typeof windows) => (windows = w),
    getWindows: () => windows,
  };
}

describe("service worker: caching", () => {
  it("precaches only the offline page, its stylesheet and the icon, and drops old cache versions on activate", async () => {
    const sw = load();
    sw.stores.set("tsaad-static-v0", new Map());
    sw.stores.set("something-else", new Map());
    await sw.run("install", {});
    await sw.run("activate", {});
    expect([...sw.stores.keys()]).toEqual(["tsaad-offline-v1"]); // old versions and foreign caches are gone
    const offline = sw.stores.get("tsaad-offline-v1")!;
    expect([...offline.keys()].map((u) => new URL(u).pathname).sort()).toEqual(["/icons/icon-192.png", "/offline.css", "/offline.html"]);
  });

  it("caches immutable static assets (cache-first), and serves them again without the network", async () => {
    const sw = load();
    await sw.run("install", {});
    const url = `${ORIGIN}/_next/static/chunks/abc123.js`;
    expect(await (await sw.doFetch(url))!.text()).toBe("net");
    expect(sw.putLog).toEqual([url]);
    sw.setOnline(false);
    expect(await (await sw.doFetch(url))!.text()).toBe("net");
  });

  it("never caches or intercepts HTML navigations, RSC, /api, per-user pages or cross-origin requests", async () => {
    const sw = load();
    await sw.run("install", {});
    for (const [url, mode] of [
      [`${ORIGIN}/today`, "navigate"],
      [`${ORIGIN}/live`, "navigate"],
      [`${ORIGIN}/today?_rsc=abc`, "cors"],
      [`${ORIGIN}/api/video/3`, "cors"],
      [`${ORIGIN}/api/push`, "cors"],
      [`${ORIGIN}/api/live/7/ics`, "cors"],
      [`${ORIGIN}/manifest.webmanifest`, "cors"],
      ["https://iframe.mediadelivery.net/embed/1/x", "navigate"],
    ] as const) {
      await sw.doFetch(url, { mode });
    }
    expect(sw.putLog).toEqual([]);
    // POST is never touched at all
    expect(await sw.doFetch(`${ORIGIN}/api/push`, { method: "POST" })).toBeUndefined();
    // the only caches are the two precache/static ones, and the static one is empty
    expect([...sw.stores.get("tsaad-static-v1")?.keys() ?? []]).toEqual([]);
  });

  it("navigation is network-first; offline falls back to the static page", async () => {
    const sw = load();
    await sw.run("install", {});
    expect(await (await sw.doFetch(`${ORIGIN}/today`, { mode: "navigate" }))!.text()).toBe("net");
    sw.setOnline(false);
    expect(await (await sw.doFetch(`${ORIGIN}/today`, { mode: "navigate" }))!.text()).toBe("static");
  });

  it("does not store a failed or opaque static response", async () => {
    const sw = load();
    await sw.run("install", {});
    sw.nextResponse({ status: 404 });
    await sw.doFetch(`${ORIGIN}/_next/static/chunks/missing.js`);
    sw.nextResponse({ type: "opaque" });
    await sw.doFetch(`${ORIGIN}/icons/other.png`);
    expect(sw.putLog).toEqual([]);
  });
});

describe("service worker: push and notification click", () => {
  it("shows title, body and tag from the payload, with the icon and RTL Hebrew", async () => {
    const sw = load();
    await sw.run("push", { data: { json: () => ({ title: "צעד קטן ביום", body: "יום 5 נפתח.", url: "/today", tag: "day-5" }) } });
    expect(sw.shown).toHaveLength(1);
    expect(sw.shown[0].title).toBe("צעד קטן ביום");
    expect(sw.shown[0].options).toMatchObject({ body: "יום 5 נפתח.", icon: "/icons/icon-192.png", lang: "he", dir: "rtl", tag: "day-5", data: { url: "/today" } });
  });

  it("still shows a notification for an empty or malformed payload (a push must always be visible)", async () => {
    const sw = load();
    await sw.run("push", {});
    await sw.run("push", { data: { json: () => { throw new Error("bad json"); } } });
    expect(sw.shown.map((s) => s.title)).toEqual(["צעד קטן ביום", "צעד קטן ביום"]);
  });

  it("clamps oversized text and refuses a cross-origin or non-string url (falls back to /today)", async () => {
    const sw = load();
    await sw.run("push", { data: { json: () => ({ title: "t".repeat(500), body: "b".repeat(2000), url: "https://evil.example/phish" }) } });
    const o = sw.shown[0];
    expect((o.title as string).length).toBeLessThanOrEqual(100);
    expect((o.options.body as string).length).toBeLessThanOrEqual(300);
    expect(o.options.data).toEqual({ url: "/today" });
    await sw.run("push", { data: { json: () => ({ title: "x", url: 42 }) } });
    expect(sw.shown[1].options.data).toEqual({ url: "/today" });
  });

  const click = (sw: ReturnType<typeof load>, url: unknown) =>
    sw.run("notificationclick", { notification: { close: () => undefined, data: { url } } });

  it("opens a new window on the same origin when none is open", async () => {
    const sw = load();
    await click(sw, "/today");
    expect(sw.opened).toEqual(["/today"]);
  });

  it("focuses and navigates an existing same-origin window; ignores other origins", async () => {
    const sw = load();
    const mk = (url: string) => {
      const w = { url, focused: false, navigated: undefined as string | undefined, focus: async () => void (w.focused = true), navigate: async (u: string) => void (w.navigated = u) };
      return w;
    };
    const foreign = mk("https://evil.example/");
    const mine = mk(`${ORIGIN}/path`);
    sw.setWindows([foreign, mine]);
    await click(sw, "/today");
    expect(foreign.focused).toBe(false);
    expect(mine.focused).toBe(true);
    expect(mine.navigated).toBe("/today");
    expect(sw.opened).toEqual([]);
  });

  it("a cross-origin target in the notification data is replaced by /today", async () => {
    const sw = load();
    await click(sw, "https://evil.example/x");
    await click(sw, "javascript:alert(1)");
    await click(sw, undefined);
    expect(sw.opened).toEqual(["/today", "/today", "/today"]);
  });
});
