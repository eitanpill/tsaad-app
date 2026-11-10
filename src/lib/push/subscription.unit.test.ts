import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fakeSubscription } from "../../../test/push-keys";
import { isValidAuthSecret, isValidP256dh, subscribeSchema, unsubscribeSchema } from "./subscription";

describe("p256dh", () => {
  it("accepts a real uncompressed P-256 point", () => {
    expect(isValidP256dh(fakeSubscription().keys.p256dh)).toBe(true);
  });
  it("rejects wrong length, wrong prefix, padding, bad alphabet and points off the curve", () => {
    const good = Buffer.from(fakeSubscription().keys.p256dh, "base64url");
    const enc = (b: Buffer) => b.toString("base64url");
    expect(isValidP256dh(enc(good.subarray(0, 64)))).toBe(false);
    expect(isValidP256dh(enc(Buffer.concat([good, Buffer.from([1])])))).toBe(false);
    const compressedPrefix = Buffer.from(good);
    compressedPrefix[0] = 0x02;
    expect(isValidP256dh(enc(compressedPrefix))).toBe(false);
    // x, y arbitrary: not on the curve (with overwhelming probability)
    expect(isValidP256dh(enc(Buffer.concat([Buffer.from([4]), randomBytes(64)])))).toBe(false);
    expect(isValidP256dh(`${enc(good)}=`)).toBe(false);
    expect(isValidP256dh(enc(good).replace(/.$/, "+"))).toBe(false);
    expect(isValidP256dh("")).toBe(false);
    expect(isValidP256dh(42)).toBe(false);
    expect(isValidP256dh(undefined)).toBe(false);
  });
});

describe("auth secret", () => {
  it("is exactly 16 bytes of base64url", () => {
    expect(isValidAuthSecret(randomBytes(16).toString("base64url"))).toBe(true);
    expect(isValidAuthSecret(randomBytes(15).toString("base64url"))).toBe(false);
    expect(isValidAuthSecret(randomBytes(17).toString("base64url"))).toBe(false);
    expect(isValidAuthSecret(`${randomBytes(16).toString("base64url")}==`)).toBe(false);
    expect(isValidAuthSecret("a+b/c+d/e+f/g+h/i+j/kl")).toBe(false);
    expect(isValidAuthSecret(null)).toBe(false);
  });
});

describe("subscribeSchema", () => {
  const ok = fakeSubscription();
  it("accepts a PushSubscription.toJSON() shape (extra fields are dropped)", () => {
    const r = subscribeSchema.safeParse({ ...ok, expirationTime: null });
    expect(r.success).toBe(true);
    expect(r.success && Object.keys(r.data).sort()).toEqual(["endpoint", "keys"]);
  });
  it("rejects endpoints outside the allowlist, plain http, and missing keys", () => {
    expect(subscribeSchema.safeParse({ ...ok, endpoint: "https://evil.example/x" }).success).toBe(false);
    expect(subscribeSchema.safeParse({ ...ok, endpoint: "http://fcm.googleapis.com/fcm/send/x" }).success).toBe(false);
    expect(subscribeSchema.safeParse({ ...ok, endpoint: "https://127.0.0.1/x" }).success).toBe(false);
    expect(subscribeSchema.safeParse({ endpoint: ok.endpoint }).success).toBe(false);
    expect(subscribeSchema.safeParse({ endpoint: ok.endpoint, keys: { p256dh: ok.keys.p256dh } }).success).toBe(false);
    expect(subscribeSchema.safeParse({ ...ok, keys: { ...ok.keys, auth: "short" } }).success).toBe(false);
    expect(subscribeSchema.safeParse(null).success).toBe(false);
    expect(subscribeSchema.safeParse("x").success).toBe(false);
  });
  it("unsubscribe needs a non-empty endpoint string of bounded length", () => {
    expect(unsubscribeSchema.safeParse({ endpoint: ok.endpoint }).success).toBe(true);
    expect(unsubscribeSchema.safeParse({ endpoint: "" }).success).toBe(false);
    expect(unsubscribeSchema.safeParse({ endpoint: "x".repeat(3000) }).success).toBe(false);
    expect(unsubscribeSchema.safeParse({}).success).toBe(false);
  });
});
