// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  AuthConfigError,
  getActivationTtlMinutes,
  getAppOrigin,
  getSessionSecret,
  sessionCookieName,
  shouldUseSecureCookies,
} from "./config";
import { constantTimeEqual, hmacHex, newToken, sha256Hex } from "./crypto";
import { phoneCandidates } from "./forgot";
import { isSameOrigin, rejectCrossOrigin } from "./origin";
import {
  hashPassword,
  passwordRequirements,
  validatePassword,
  verifyAgainstDummy,
  verifyPassword,
} from "./password";
import { PASSWORD_POLICY } from "./policy";
import { rateLimitKeys } from "./rate-limit";
import { clientIp } from "./request";

const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });
const SECRET = "x".repeat(32);

describe("password policy", () => {
  it("is a single config constant", () => {
    expect(PASSWORD_POLICY).toMatchObject({ minLength: 8, requireDigit: true, maxLength: 128 });
  });
  it("rejects empty, short, no digit, too long, and the username", () => {
    expect(validatePassword("")).toBe("required");
    expect(validatePassword("abc12")).toBe("tooShort");
    expect(validatePassword("abcdefgh")).toBe("noDigit");
    expect(validatePassword("a1".repeat(65))).toBe("tooLong");
    expect(validatePassword("noa.k1234", { username: "NOA.K1234" })).toBe("sameAsUsername");
    expect(validatePassword("abcdefg1", { username: "noa" })).toBeNull();
  });
  it("counts characters, not UTF-16 units", () => {
    expect(validatePassword("😀".repeat(7) + "1")).toBeNull();
    expect(validatePassword("😀".repeat(128) + "1")).toBe("tooLong");
  });
  it("reports live requirements", () => {
    expect(passwordRequirements("abc")).toEqual({ minLength: false, digit: false });
    expect(passwordRequirements("abcdefg1")).toEqual({ minLength: true, digit: true });
  });
  it("policy can change in one place", () => {
    const relaxed = { ...PASSWORD_POLICY, requireDigit: false, minLength: 4 };
    expect(validatePassword("abcd", {}, relaxed)).toBeNull();
  });
});

describe("argon2id", () => {
  it("hashes with argon2id, verifies, and rejects a wrong password", async () => {
    const h = await hashPassword("correct horse 9");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(h).toContain("m=19456,t=2,p=1");
    expect(await verifyPassword(h, "correct horse 9")).toBe(true);
    expect(await verifyPassword(h, "correct horse 8")).toBe(false);
  });
  it("salts every hash", async () => {
    expect(await hashPassword("same-pass-1")).not.toBe(await hashPassword("same-pass-1"));
  });
  it("returns false on a malformed hash, and the dummy check never succeeds", async () => {
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
    expect(await verifyAgainstDummy("anything1")).toBe(false);
  });
});

describe("crypto helpers", () => {
  it("issues 32 random bytes as base64url", () => {
    const t = newToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(t);
  });
  it("sha256 hex", () => {
    expect(sha256Hex("a")).toBe(createHash("sha256").update("a").digest("hex"));
  });
  it("hmac is keyed and purpose-separated, and is not plain sha256", () => {
    const a = hmacHex(SECRET, "p", "noa");
    expect(a).toBe(hmacHex(SECRET, "p", "noa"));
    expect(a).not.toBe(hmacHex("y".repeat(32), "p", "noa"));
    expect(a).not.toBe(hmacHex(SECRET, "q", "noa"));
    expect(a).not.toBe(sha256Hex("noa"));
  });
  it("constantTimeEqual compares values of any length", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});

describe("rate-limit keys", () => {
  it("normalizes the identifier and hashes both parts with the secret", () => {
    const k = rateLimitKeys(SECRET, " Noa.K ", "1.2.3.4");
    expect(k.identifierHash).toBe(rateLimitKeys(SECRET, "noa.k", "9.9.9.9").identifierHash);
    expect(k.ipHash).not.toBe("1.2.3.4");
    expect(k.identifierHash).not.toBe(sha256Hex("noa.k"));
    expect(k.identifierHash).not.toBe(rateLimitKeys("z".repeat(32), "noa.k", null).identifierHash);
    expect(rateLimitKeys(SECRET, "noa", null).ipHash).toBeNull();
  });
});

describe("config fails closed", () => {
  it("requires SESSION_SECRET of at least 32 bytes", () => {
    expect(() => getSessionSecret({ NODE_ENV: "production" })).toThrow(AuthConfigError);
    expect(() => getSessionSecret({ NODE_ENV: "production", SESSION_SECRET: "short" })).toThrow(AuthConfigError);
    expect(getSessionSecret({ NODE_ENV: "production", SESSION_SECRET: SECRET })).toBe(SECRET);
  });
  it("counts bytes, not characters", () => {
    expect(() => getSessionSecret({ SESSION_SECRET: "א".repeat(15) })).toThrow(); // 30 bytes
    expect(getSessionSecret({ SESSION_SECRET: "א".repeat(16) })).toBeTruthy(); // 32 bytes
  });
  it("refuses to issue links in production without a TTL", () => {
    expect(() => getActivationTtlMinutes({ NODE_ENV: "production" })).toThrow(AuthConfigError);
    expect(() => getActivationTtlMinutes({ NODE_ENV: "production", ACTIVATION_LINK_TTL_MINUTES: "  " })).toThrow();
    expect(getActivationTtlMinutes({ NODE_ENV: "production", ACTIVATION_LINK_TTL_MINUTES: "90" })).toBe(90);
    expect(() => getActivationTtlMinutes({ ACTIVATION_LINK_TTL_MINUTES: "0" })).toThrow();
    expect(() => getActivationTtlMinutes({ ACTIVATION_LINK_TTL_MINUTES: "1.5" })).toThrow();
    expect(getActivationTtlMinutes({ NODE_ENV: "test" })).toBeGreaterThan(0);
  });
  it("requires APP_ORIGIN in production", () => {
    expect(() => getAppOrigin({ NODE_ENV: "production" })).toThrow(AuthConfigError);
    expect(getAppOrigin({ APP_ORIGIN: "https://app.example.com" })).toBe("https://app.example.com");
    expect(getAppOrigin({})).toBeUndefined();
  });
});

describe("session cookie", () => {
  it("uses __Host- and Secure in production and on https", () => {
    expect(sessionCookieName({ NODE_ENV: "production" })).toBe("__Host-tsaad_session");
    expect(shouldUseSecureCookies({ NODE_ENV: "development", APP_ORIGIN: "https://x.example" })).toBe(true);
  });
  it("drops both only for http://localhost outside production", () => {
    const env = { NODE_ENV: "development", APP_ORIGIN: "http://localhost:3000" };
    expect(shouldUseSecureCookies(env)).toBe(false);
    expect(sessionCookieName(env)).toBe("tsaad_session");
    expect(shouldUseSecureCookies({ NODE_ENV: "production", APP_ORIGIN: "http://localhost:3000" })).toBe(true);
  });
});

describe("origin check", () => {
  const app = "https://app.example.com";
  it("accepts a matching Origin, or a matching Referer when Origin is absent", () => {
    expect(isSameOrigin(headers({ origin: app }), app)).toBe(true);
    expect(isSameOrigin(headers({ referer: `${app}/login` }), app)).toBe(true);
  });
  it("rejects other origins, lookalikes, missing headers and cross-site fetches", () => {
    expect(isSameOrigin(headers({ origin: "https://evil.example" }), app)).toBe(false);
    expect(isSameOrigin(headers({ origin: "https://app.example.com.evil.example" }), app)).toBe(false);
    expect(isSameOrigin(headers({ origin: "null" }), app)).toBe(false);
    expect(isSameOrigin(headers({}), app)).toBe(false);
    expect(isSameOrigin(headers({ referer: "https://evil.example/x" }), app)).toBe(false);
    expect(isSameOrigin(headers({ referer: "garbage" }), app)).toBe(false);
    expect(isSameOrigin(headers({ origin: app, "sec-fetch-site": "cross-site" }), app)).toBe(false);
  });
  it("without APP_ORIGIN (development) compares with the Host header", () => {
    expect(isSameOrigin(headers({ origin: "http://localhost:3000", host: "localhost:3000" }), undefined)).toBe(true);
    expect(isSameOrigin(headers({ origin: "http://evil.test", host: "localhost:3000" }), undefined)).toBe(false);
    expect(isSameOrigin(headers({ origin: "http://localhost:3000" }), undefined)).toBe(false);
  });
  it("rejectCrossOrigin returns a 403 response for handlers", () => {
    const req = new Request("https://app.example.com/api/x", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    process.env.APP_ORIGIN = app;
    try {
      expect(rejectCrossOrigin(req)?.status).toBe(403);
      const ok = new Request("https://app.example.com/api/x", { method: "POST", headers: { origin: app } });
      expect(rejectCrossOrigin(ok)).toBeNull();
    } finally {
      delete process.env.APP_ORIGIN;
    }
  });
});

describe("forgot helpers", () => {
  it("normalizes phone numbers to comparable candidates", () => {
    expect(phoneCandidates("050-123 4567")).toEqual(["0501234567", "972501234567"]);
    expect(phoneCandidates("+972 50 123 4567")).toEqual(["972501234567", "0501234567"]);
    expect(phoneCandidates("noa.k")).toEqual([]);
    expect(phoneCandidates("12345")).toEqual([]);
  });
});

describe("client ip", () => {
  it("prefers x-real-ip, then the first x-forwarded-for hop", () => {
    expect(clientIp(headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(headers({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
    expect(clientIp(headers({}))).toBeNull();
  });
});
