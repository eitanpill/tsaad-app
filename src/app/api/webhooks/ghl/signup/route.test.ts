// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tasks: Array<() => Promise<void>> = [];
vi.mock("next/server", () => ({ after: (t: () => Promise<void>) => void tasks.push(t) }));
// No request below may reach the database (auth/shape failures), so a connection attempt is a test failure.
vi.mock("@/db", () => ({ getDb: () => { throw new Error("db must not be touched"); } }));

const SECRET = "r".repeat(40);
const URL_ = "http://localhost:3100/api/webhooks/ghl/signup";
const saved = { ...process.env };

async function post(body: string | undefined, headers: Record<string, string> = {}) {
  const { POST } = await import("./route");
  return POST(
    new Request(URL_, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tsaad-webhook-secret": SECRET, ...headers },
      body,
    }),
  );
}

describe("POST /api/webhooks/ghl/signup (route level, no database)", () => {
  beforeEach(() => {
    process.env.GHL_WEBHOOK_SECRET = SECRET;
    process.env.APP_ORIGIN = "http://localhost:3100";
    process.env.SESSION_SECRET = "x".repeat(40);
    delete process.env.TRUST_PROXY_IP_HEADERS;
    delete process.env.VERCEL;
  });
  afterEach(() => {
    process.env = { ...saved };
    tasks.length = 0;
  });

  const ok = JSON.stringify({ contact_id: "c1", email: "a@b.co" });

  it("401 without or with a wrong secret, no-store, and no hint in the body", async () => {
    for (const h of [{ "x-tsaad-webhook-secret": "" }, { "x-tsaad-webhook-secret": "nope" }]) {
      const r = await post(ok, h);
      expect(r.status).toBe(401);
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(await r.json()).toEqual({ ok: false, error: "unauthorized" });
    }
    const { POST } = await import("./route");
    const bare = await POST(new Request(URL_, { method: "POST", headers: { "content-type": "application/json" }, body: ok }));
    expect(bare.status).toBe(401);
  });

  it("a secret in the query string is not accepted", async () => {
    const { POST } = await import("./route");
    const r = await POST(new Request(`${URL_}?secret=${SECRET}`, { method: "POST", headers: { "content-type": "application/json" }, body: ok }));
    expect(r.status).toBe(401);
  });

  it("503 when the secret is unset or too short (fail closed)", async () => {
    delete process.env.GHL_WEBHOOK_SECRET;
    expect((await post(ok)).status).toBe(503);
    process.env.GHL_WEBHOOK_SECRET = "short-secret";
    expect((await post(ok, { "x-tsaad-webhook-secret": "short-secret" })).status).toBe(503);
  });

  it("413 for a declared or an actually oversized body (also chunked, without content-length)", async () => {
    const big = JSON.stringify({ contact_id: "c1", email: "a@b.co", pad: "x".repeat(17 * 1024) });
    expect((await post(big)).status).toBe(413);
    const { POST } = await import("./route");
    const stream = new ReadableStream({
      start(c) {
        for (let i = 0; i < 20; i++) c.enqueue(new TextEncoder().encode("x".repeat(1024)));
        c.close();
      },
    });
    const r = await POST(
      new Request(URL_, {
        method: "POST",
        headers: { "content-type": "application/json", "x-tsaad-webhook-secret": SECRET },
        body: stream,
        duplex: "half",
      } as RequestInit),
    );
    expect(r.status).toBe(413);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("415 for a non-JSON content type (after auth)", async () => {
    expect((await post(ok, { "content-type": "text/plain" })).status).toBe(415);
    expect((await post(ok, { "content-type": "application/x-www-form-urlencoded" })).status).toBe(415);
  });

  it("400 for malformed JSON, non-objects, missing contact id, and no usable contact details", async () => {
    for (const b of ["{nope", "[]", "5", "null", "", JSON.stringify({ email: "a@b.co" }), JSON.stringify({ contact_id: "c" }), JSON.stringify({ contact_id: "c", email: "bad", phone: "1" })]) {
      const r = await post(b);
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ ok: false, error: "invalid" });
    }
  });

  it("400 for an invalid event id header", async () => {
    expect((await post(ok, { "x-tsaad-event-id": "bad id!" })).status).toBe(400);
  });

  it("a stale timestamp is 401 even with the right static secret", async () => {
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    expect((await post(ok, { "x-tsaad-timestamp": old })).status).toBe(401);
  });

  it("only POST is exported", async () => {
    const mod = (await import("./route")) as Record<string, unknown>;
    expect(Object.keys(mod).sort()).toEqual(["POST"]);
  });
});
