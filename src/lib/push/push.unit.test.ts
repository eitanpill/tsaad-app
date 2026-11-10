// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { copy } from "@/content/copy.he";
import { DAYS } from "@/content/days";
import { isAllowedPushEndpoint } from "./endpoints";
import { buildReminderMessage } from "./message";
import { createDryRunPushSender, createWebPushSender, getPushSender, readVapid } from "./sender";

const VAPID = { subject: "mailto:a@example.test", publicKey: "pub", privateKey: "priv" };
const SUB = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  p256dh: "k",
  auth: "a",
};

describe("isAllowedPushEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/xyz",
    "https://web.push.apple.com/QWERTY",
    "https://par02p.notify.windows.com/w/?token=abc",
    "https://FCM.googleapis.com/x",
  ])("accepts %s", (u) => expect(isAllowedPushEndpoint(u)).toBe(true));

  it.each([
    "http://fcm.googleapis.com/x",
    "https://evil.example/x",
    "https://fcm.googleapis.com.evil.example/x",
    "https://evilfcm.googleapis.com/x",
    "https://push.apple.com.evil.example/",
    "https://notify.windows.com/",
    "https://.push.apple.com/",
    "https://user:pw@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "https://127.0.0.1/x",
    "https://localhost/x",
    "https://[::1]/x",
    "https://fcm.googleapis.com/x#frag",
    "javascript:alert(1)",
    "//fcm.googleapis.com/x",
    "https://evil.example\\@fcm.googleapis.com/x",
    "https://fcm.googleapis.com%2F@evil.example/x",
    "https://fcm.googleapis.com\u3002evil.example/x",
    "https://fcm.googleapis.com.evil.example./x",
    "https://xn--fcm-googleapis-com.example/x",
    "https://0x7f000001/x",
    "https://2130706433/x",
    "",
    "not a url",
  ])("rejects %s", (u) => expect(isAllowedPushEndpoint(u)).toBe(false));

  it("rejects non-strings and overlong values", () => {
    expect(isAllowedPushEndpoint(undefined)).toBe(false);
    expect(isAllowedPushEndpoint(42)).toBe(false);
    expect(isAllowedPushEndpoint(`https://fcm.googleapis.com/${"a".repeat(3000)}`)).toBe(false);
  });
});

describe("buildReminderMessage", () => {
  it("uses perDay with the day's habit on normal days", () => {
    const m = buildReminderMessage(3, {});
    expect(m.body).toBe(copy.push.perDay.replace("{day}", "3").replace("{habit}", DAYS[2].habit.title));
    expect(m.title).toBe(copy.push.title);
    expect(m.url).toBe("/today");
  });
  it("keeps every day's reminder short enough for a notification (the longest habit included)", () => {
    for (const d of DAYS) {
      const m = buildReminderMessage(d.day, { 7: "20:00", 14: "19:30" });
      expect(m.body.length, `day ${d.day}: ${m.body}`).toBeLessThanOrEqual(100);
    }
  });
  it("uses liveDay with the configured time on live days", () => {
    expect(buildReminderMessage(7, { 7: "20:00" }).body).toBe(
      copy.push.liveDay.replace("{day}", "7").replace("{time}", "20:00"),
    );
    expect(buildReminderMessage(14, { 14: "19:30" }).body).toContain("19:30");
  });
  it("falls back to generic on a live day without a time (never invents one)", () => {
    expect(buildReminderMessage(7, {}).body).toBe(copy.push.generic.replace("{day}", "7"));
    expect(buildReminderMessage(14, { 7: "20:00" }).body).toBe(copy.push.generic.replace("{day}", "14"));
  });
});

describe("push senders", () => {
  it("dry-run sender never touches the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const s = createDryRunPushSender();
    expect(s.dryRun).toBe(true);
    expect(await s.send(SUB, "x")).toEqual({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("getPushSender is dry-run unless enabled is exactly true and VAPID is complete", () => {
    const env = { VAPID_PUBLIC_KEY: "p", VAPID_PRIVATE_KEY: "q", VAPID_SUBJECT: "mailto:a@b.co" };
    expect(getPushSender(false, env).dryRun).toBe(true);
    expect(getPushSender(true, {}).dryRun).toBe(true);
    expect(getPushSender(true, { ...env, VAPID_PRIVATE_KEY: undefined }).dryRun).toBe(true);
    expect(getPushSender(true, env).dryRun).toBe(false);
    expect(readVapid({})).toBeNull();
  });

  it("web-push sender maps statuses (fake transport, no network)", async () => {
    const calls: unknown[] = [];
    const fake = (code?: number) =>
      createWebPushSender(VAPID, async (...args) => {
        calls.push(args);
        if (code) throw Object.assign(new Error("boom"), { statusCode: code });
        return {};
      });
    expect(await fake().send(SUB, "p")).toEqual({ ok: true });
    expect(await fake(410).send(SUB, "p")).toEqual({ ok: false, gone: true, statusCode: 410 });
    expect(await fake(404).send(SUB, "p")).toEqual({ ok: false, gone: true, statusCode: 404 });
    expect(await fake(500).send(SUB, "p")).toEqual({ ok: false, gone: false, statusCode: 500 });
    expect(await fake(429).send(SUB, "p")).toMatchObject({ ok: false, gone: false });
    expect(calls).toHaveLength(5);
  });

  it("web-push sender gives up after the overall deadline (a hanging push service cannot stall the run)", async () => {
    const hang = vi.fn(() => new Promise<never>(() => {}));
    const s = createWebPushSender(VAPID, hang, 20);
    const t0 = Date.now();
    const r = await s.send({ endpoint: "https://fcm.googleapis.com/fcm/send/x", p256dh: "p", auth: "a" }, "{}");
    expect(r).toEqual({ ok: false, gone: false, statusCode: undefined });
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(hang).toHaveBeenCalledTimes(1);
  });

  it("web-push sender refuses endpoints outside the allowlist without sending", async () => {
    const transport = vi.fn();
    const s = createWebPushSender(VAPID, transport);
    expect(await s.send({ ...SUB, endpoint: "https://evil.example/x" }, "p")).toEqual({ ok: false, gone: true });
    expect(transport).not.toHaveBeenCalled();
  });
});

describe("push payload as the service worker reads it", () => {
  it("is JSON with title, body, a same-origin path url, and a tag (what public/sw.js expects)", () => {
    const m = buildReminderMessage(5, {});
    const parsed = JSON.parse(JSON.stringify(m)) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(["body", "tag", "title", "url"]);
    expect(parsed.url).toBe("/today");
    expect(String(parsed.url).startsWith("/")).toBe(true);
    expect(String(parsed.url).startsWith("//")).toBe(false);
    expect((parsed.title as string).length).toBeLessThanOrEqual(100);
    expect((parsed.body as string).length).toBeLessThanOrEqual(300);
  });
});
