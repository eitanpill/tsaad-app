// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as cleanupGET } from "@/app/api/cron/cleanup/route";
import { GET as remindersGET } from "@/app/api/cron/reminders/route";
import { GET as syncGET } from "@/app/api/cron/sync/route";
import { isCronAuthorized } from "./auth";

const SECRET = "c".repeat(24);
const req = (auth?: string) =>
  new Request("http://localhost/api/cron/x", { headers: auth === undefined ? {} : { authorization: auth } });

describe("isCronAuthorized", () => {
  it("accepts only the exact bearer secret", () => {
    expect(isCronAuthorized(req(`Bearer ${SECRET}`), SECRET)).toBe(true);
    expect(isCronAuthorized(req(), SECRET)).toBe(false);
    expect(isCronAuthorized(req(""), SECRET)).toBe(false);
    expect(isCronAuthorized(req(SECRET), SECRET)).toBe(false);
    expect(isCronAuthorized(req(`bearer ${SECRET}`), SECRET)).toBe(false);
    expect(isCronAuthorized(req(`Bearer ${SECRET}x`), SECRET)).toBe(false);
    expect(isCronAuthorized(req(`Bearer ${SECRET.slice(0, -1)}`), SECRET)).toBe(false);
    expect(isCronAuthorized(req(`Bearer ${"d".repeat(24)}`), SECRET)).toBe(false);
  });
  it("fails closed when the secret is unset, empty or short", () => {
    expect(isCronAuthorized(req("Bearer undefined"), undefined)).toBe(false);
    expect(isCronAuthorized(req("Bearer "), "")).toBe(false);
    expect(isCronAuthorized(req("Bearer short"), "short")).toBe(false);
    expect(isCronAuthorized(req(`Bearer ${"s".repeat(15)}`), "s".repeat(15))).toBe(false);
    expect(isCronAuthorized(req(`Bearer ${"s".repeat(16)}`), "s".repeat(16))).toBe(true);
  });
  it("compares in constant time (uses the shared timing-safe helper, never ===)", () => {
    const src = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");
    expect(src).toContain("constantTimeEqual(");
    expect(src).not.toMatch(/(===|!==|==)\s*`Bearer/);
    expect(src).not.toMatch(/\.startsWith\(|\.includes\(/);
  });
});

describe("cron route handlers", () => {
  const saved = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  });

  it.each([
    ["reminders", remindersGET],
    ["sync", syncGET],
    ["cleanup", cleanupGET],
  ])("%s: 401 and no-store for missing or wrong credentials", async (_n, GET) => {
    for (const r of [req(), req("Bearer wrong"), req(`Bearer ${SECRET}x`)]) {
      const res = await GET(r);
      expect(res.status).toBe(401);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
  });

  it.each([
    ["reminders", remindersGET],
    ["sync", syncGET],
    ["cleanup", cleanupGET],
  ])("%s: 401 when CRON_SECRET is unset or short, even with a matching header", async (_n, GET) => {
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer undefined"))).status).toBe(401);
    expect((await GET(req("Bearer "))).status).toBe(401);
    process.env.CRON_SECRET = "tooshort";
    expect((await GET(req("Bearer tooshort"))).status).toBe(401);
  });

  it("sync with the right secret and default env: 200, disabled, no db, no network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await syncGET(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ enabled: false, claimed: 0, sent: 0, failed: 0, dead: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
