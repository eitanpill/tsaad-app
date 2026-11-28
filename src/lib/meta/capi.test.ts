import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { buildPurchaseBody, capiConfig, hashedUserData, sendPurchase, type PurchaseEvent } from "./capi";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const TOKEN = "EAAtestTOKEN_1234567890abcdef";
const live = { META_PIXEL_ID: "1102227115079573", META_CAPI_TOKEN: TOKEN, META_CAPI_MODE: "live" };
const ev: PurchaseEvent = {
  eventId: "ghl:signup:abc",
  email: " Dana@Example.com ",
  phoneE164: "+972521234567",
  ghlContactId: "c123",
  value: 79,
  currency: "ILS",
  eventTime: new Date("2026-12-01T10:00:00Z"),
  sourceUrl: "https://14days.yogit-yoga.co.il/tsaad",
};
const log = () => {
  const l = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() };
  l.child.mockReturnValue(l);
  return l;
};

describe("capiConfig", () => {
  it("is off unless mode, pixel and token are all valid", () => {
    expect(capiConfig({})).toBeNull();
    expect(capiConfig({ ...live, META_CAPI_MODE: "off" })).toBeNull();
    expect(capiConfig({ ...live, META_CAPI_MODE: "LIVE" })).toBeNull();
    expect(capiConfig({ ...live, META_PIXEL_ID: "abc" })).toBeNull();
    expect(capiConfig({ ...live, META_CAPI_TOKEN: "short" })).toBeNull();
    expect(capiConfig({ ...live, META_CAPI_TOKEN: `${TOKEN}&x=1` })).toBeNull();
    expect(capiConfig(live)).toEqual({ pixelId: "1102227115079573", token: TOKEN, mode: "live" });
  });
  it("test mode needs a test code (otherwise off, so test events are never counted as real)", () => {
    expect(capiConfig({ ...live, META_CAPI_MODE: "test" })).toBeNull();
    expect(capiConfig({ ...live, META_CAPI_MODE: "test", META_CAPI_TEST_CODE: "TEST123" })).toMatchObject({ mode: "test", testCode: "TEST123" });
  });
});

describe("purchase payload", () => {
  it("hashes email (lowercased, trimmed) and phone (digits with 972), never sends them raw", () => {
    const u = hashedUserData({ email: ev.email, phoneE164: ev.phoneE164, externalId: "ghl:c123" });
    expect(u).toEqual({
      em: [sha("dana@example.com")],
      ph: [sha("972521234567")],
      external_id: [sha("ghl:c123")],
      country: [sha("il")],
    });
    expect(hashedUserData({ email: null, phoneE164: null, externalId: "x" })).not.toHaveProperty("em");
  });
  it("builds a Purchase with value, currency, event id and no raw PII", () => {
    const body = buildPurchaseBody(capiConfig(live)!, ev);
    const json = JSON.stringify(body);
    expect(json).not.toContain("dana");
    expect(json).not.toContain("521234567");
    expect(json).not.toContain("c123\"");
    expect(body).toMatchObject({
      access_token: TOKEN,
      data: [
        {
          event_name: "Purchase",
          event_id: "ghl:signup:abc",
          event_time: 1796119200,
          action_source: "system_generated",
          event_source_url: "https://14days.yogit-yoga.co.il/tsaad",
          custom_data: { value: 79, currency: "ILS" },
        },
      ],
    });
    expect(body).not.toHaveProperty("test_event_code");
    const t = buildPurchaseBody(capiConfig({ ...live, META_CAPI_MODE: "test", META_CAPI_TEST_CODE: "TEST1" })!, ev);
    expect(t.test_event_code).toBe("TEST1");
  });
});

describe("sendPurchase", () => {
  it("does nothing when off", async () => {
    const fetchImpl = vi.fn();
    expect(await sendPurchase(ev, { log: log(), env: {}, fetchImpl })).toBe("off");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("never calls the network in tests without an injected fetch", async () => {
    expect(await sendPurchase(ev, { log: log(), env: { ...live, VITEST: "true" } })).toBe("off");
  });
  it("posts to the pixel's events endpoint with the token in the body, not the URL", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const l = log();
    expect(await sendPurchase(ev, { log: l, env: live, fetchImpl })).toBe("sent");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v24.0/1102227115079573/events");
    expect(url).not.toContain(TOKEN);
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect(JSON.parse(String(init.body)).access_token).toBe(TOKEN);
  });
  it("logs only status and Meta error codes on rejection, never the token or the body", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ error: { code: 190, error_subcode: 463, message: `bad ${TOKEN}` } }), { status: 400 }),
    );
    const l = log();
    expect(await sendPurchase(ev, { log: l, env: live, fetchImpl })).toBe("failed");
    expect(l.error).toHaveBeenCalledWith("meta capi: purchase rejected", { status: 400, mode: "live", code: 190, subcode: 463 });
    expect(JSON.stringify(l.error.mock.calls)).not.toContain(TOKEN);
  });
  it("never throws on network errors", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const l = log();
    expect(await sendPurchase(ev, { log: l, env: live, fetchImpl })).toBe("failed");
    expect(l.error).toHaveBeenCalledWith("meta capi: purchase not sent", { reason: "network" });
  });
});
