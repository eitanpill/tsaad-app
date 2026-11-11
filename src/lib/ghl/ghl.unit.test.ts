// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { parseEnv } from "@/config/env";
import { createLogger } from "@/lib/logger";
import { createGhlClient, setFieldAndTag } from "./client";
import { getGhlConfig } from "./config";
import { createLinkDelivery } from "./link-delivery";

const TOKEN = "pit-0123456789abcdef0123456789abcdef";
const cfgOf = (e: Record<string, string>, raw: Record<string, string | undefined> = {}) => getGhlConfig(parseEnv(e), raw);

describe("ghl config", () => {
  it("defaults to off, with the documented names", () => {
    const c = cfgOf({});
    expect(c).toMatchObject({
      reminderMode: "off", deliveryMode: "off", liveRefused: null,
      fields: { todayUrl: "tsaad_today_url", activationUrl: "tsaad_activation_url" },
      tags: { reminderPrefix: "tsaad_reminder_day", accountReady: "tsaad_account_ready", resetReady: "tsaad_reset_ready" },
    });
  });
  it("live needs a token and a location, else it runs as off", () => {
    expect(cfgOf({ GHL_REMINDER_MODE: "live" })).toMatchObject({ reminderMode: "off", liveRefused: expect.stringContaining("GHL_API_TOKEN") });
    const ok = cfgOf({ GHL_REMINDER_MODE: "live", GHL_DELIVERY_MODE: "dry", GHL_API_TOKEN: TOKEN, GHL_LOCATION_ID: "loc-123456" });
    expect(ok).toMatchObject({ reminderMode: "live", deliveryMode: "dry", liveRefused: null });
  });
  it("live is never enabled in test or e2e environments", () => {
    const e = { GHL_DELIVERY_MODE: "live", GHL_API_TOKEN: TOKEN, GHL_LOCATION_ID: "loc-123456" };
    for (const raw of [{ NODE_ENV: "test" }, { TSAAD_E2E: "1" }, { TSAAD_TEST_NOW: "2026-12-01T00:00:00Z" }]) {
      expect(cfgOf(e, raw)).toMatchObject({ deliveryMode: "off", liveRefused: expect.stringContaining("test") });
    }
  });
  it("rejects an unknown mode and bad names", () => {
    expect(() => parseEnv({ GHL_REMINDER_MODE: "on" })).toThrow();
    expect(() => parseEnv({ GHL_TAG_ACCOUNT_READY: "bad tag!" })).toThrow();
  });
});

const res = (status: number, body = "{}") => new Response(body, { status });

describe("ghl client (fetch is always a mock)", () => {
  it("update + add tag: v2 base, Bearer, Version header, no redirects, bodies", async () => {
    const f = vi.fn(async () => res(200));
    const c = createGhlClient({ token: TOKEN, fetchImpl: f as unknown as typeof fetch });
    const r = await setFieldAndTag(c, { contactId: "abc123XYZ", fieldKey: "tsaad_today_url", value: "https://app.example.test/today", tag: "tsaad_reminder_day3", rearm: false });
    expect(r).toEqual({ ok: true });
    const calls = f.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([u, i]) => `${i.method} ${u}`)).toEqual([
      "PUT https://services.leadconnectorhq.com/contacts/abc123XYZ",
      "POST https://services.leadconnectorhq.com/contacts/abc123XYZ/tags",
    ]);
    expect(JSON.parse(calls[0][1].body as string)).toEqual({ customFields: [{ key: "tsaad_today_url", field_value: "https://app.example.test/today" }] });
    expect(JSON.parse(calls[1][1].body as string)).toEqual({ tags: ["tsaad_reminder_day3"] });
    expect(calls[0][1].headers).toMatchObject({ Authorization: `Bearer ${TOKEN}`, Version: "2021-07-28" });
    expect(calls[0][1].redirect).toBe("error");
  });
  it("rearm removes the tag before adding it", async () => {
    const f = vi.fn(async () => res(200));
    const c = createGhlClient({ token: TOKEN, fetchImpl: f as unknown as typeof fetch });
    await setFieldAndTag(c, { contactId: "abc123XYZ", fieldKey: "k", value: "v", tag: "t", rearm: true });
    expect((f.mock.calls as unknown as [string, RequestInit][]).map(([, i]) => i.method)).toEqual(["PUT", "DELETE", "POST"]);
  });
  it("a failed field update stops before the tag", async () => {
    const f = vi.fn(async () => res(500));
    const c = createGhlClient({ token: TOKEN, fetchImpl: f as unknown as typeof fetch });
    expect(await setFieldAndTag(c, { contactId: "abc123XYZ", fieldKey: "k", value: "v", tag: "t", rearm: false })).toMatchObject({ ok: false, retryable: true });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it.each([[429, true], [500, true], [503, true], [401, false], [403, false], [404, false], [422, false]])("status %i retryable=%s", async (status, retryable) => {
    const c = createGhlClient({ token: TOKEN, fetchImpl: (async () => res(status, '{"secret":"body"}')) as unknown as typeof fetch });
    const r = await c.addTags("abc123XYZ", ["t"]);
    expect(r).toMatchObject({ ok: false, retryable });
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    expect(JSON.stringify(r)).not.toContain("body");
  });
  it("network errors and timeouts are retryable and carry no details", async () => {
    const c = createGhlClient({ token: TOKEN, fetchImpl: (async () => { throw new Error(`boom ${TOKEN} +972521234567`); }) as unknown as typeof fetch });
    const r = await c.addTags("abc123XYZ", ["t"]);
    expect(r).toEqual({ ok: false, retryable: true, error: "ghl network error" });
  });
  it("a location in the response that differs from the configured one stops with a non-retryable error", async () => {
    const c = createGhlClient({ token: TOKEN, fetchImpl: (async () => res(200, '{"contact":{"locationId":"other"}}')) as unknown as typeof fetch });
    expect(await c.updateCustomFields("abc123XYZ", [{ key: "k", value: "v" }], "mine")).toMatchObject({ ok: false, retryable: false });
  });
  it("refuses a contact id that is not a plain id (no path tricks)", async () => {
    const f = vi.fn();
    const c = createGhlClient({ token: TOKEN, fetchImpl: f as unknown as typeof fetch });
    expect(await c.addTags("../x?y", ["t"])).toMatchObject({ ok: false, retryable: false });
    expect(f).not.toHaveBeenCalled();
  });
});

describe("link delivery modes", () => {
  const lines: string[] = [];
  const log = createLogger({ level: "debug", sink: (l) => lines.push(l) });
  const link = "https://app.example.test/activate?token=SECRETTOKEN123";
  it("off/dry never call the client and never log the link", async () => {
    const client = { updateCustomFields: vi.fn(), addTags: vi.fn(), removeTags: vi.fn() };
    const d = createLinkDelivery({ cfg: cfgOf({ GHL_DELIVERY_MODE: "dry" }), client, db: () => { throw new Error("no db"); }, log });
    expect(await d.deliver({ userId: "u1", ghlContactId: "abc123XYZ", kind: "activate", link })).toBe("dry");
    expect(client.updateCustomFields).not.toHaveBeenCalled();
    const out = lines.join("\n");
    expect(out).toContain("dry-run");
    expect(out).toContain("tsaad_account_ready");
    expect(out).not.toContain("SECRETTOKEN123");
  });
  it("a non-retryable failure is dropped and logged without the link or token", async () => {
    lines.length = 0;
    const cfg = cfgOf({ GHL_DELIVERY_MODE: "live", GHL_API_TOKEN: TOKEN, GHL_LOCATION_ID: "loc-123456" });
    const client = { updateCustomFields: vi.fn(async () => ({ ok: false as const, retryable: false, error: "ghl http 404" })), addTags: vi.fn(), removeTags: vi.fn() };
    const d = createLinkDelivery({ cfg, client, db: () => { throw new Error("no db"); }, log });
    expect(await d.deliver({ userId: "u1", ghlContactId: "abc123XYZ", kind: "reset", link })).toBe("dropped");
    expect(lines.join("\n")).not.toContain("SECRETTOKEN123");
    expect(lines.join("\n")).not.toContain(TOKEN);
  });
});

describe("logger redaction of GHL secrets", () => {
  it("token and phone never appear in log lines", () => {
    const lines: string[] = [];
    const log = createLogger({ sink: (l) => lines.push(l) });
    log.error("ghl failed", { token: TOKEN, ghlToken: TOKEN, phone: "+972521234567", error: new Error(`Bearer ${TOKEN} for 052-123-4567`) });
    const out = lines.join("\n");
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain("521234567");
    expect(out).not.toContain("123-4567");
  });
});
