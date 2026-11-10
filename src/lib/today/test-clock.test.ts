import { describe, expect, it } from "vitest";
import { TEST_CLOCK_ENV, TEST_CLOCK_KEY_ENV, resolveNow, testClockAllowed } from "./test-clock";

const REAL = new Date("2030-01-01T00:00:00Z");
const FAKE = "2026-12-04T14:00:00+02:00";
const FAKE_UTC = new Date(FAKE).getTime();
const KEY = "k".repeat(40);
const e2e = { NODE_ENV: "production", TSAAD_E2E: "1", APP_ORIGIN: "http://localhost:3100", [TEST_CLOCK_KEY_ENV]: KEY };
const hdr = (now: string | null | undefined, key: string | null = KEY) => ({ now, key });

describe("test clock guard", () => {
  it("is honoured in dev and test", () => {
    expect(resolveNow({ NODE_ENV: "development", [TEST_CLOCK_ENV]: FAKE }, null, REAL).getTime()).toBe(FAKE_UTC);
    expect(resolveNow({ NODE_ENV: "test", [TEST_CLOCK_KEY_ENV]: KEY }, hdr(FAKE), REAL).getTime()).toBe(FAKE_UTC);
  });

  it("is IGNORED in production unless the local e2e opt-in and a loopback origin are both present", () => {
    const base = { NODE_ENV: "production", [TEST_CLOCK_ENV]: FAKE, [TEST_CLOCK_KEY_ENV]: KEY };
    expect(resolveNow(base, hdr(FAKE), REAL)).toBe(REAL);
    expect(resolveNow({ ...base, APP_ORIGIN: "https://app.example.com" }, hdr(FAKE), REAL)).toBe(REAL);
    expect(resolveNow({ ...base, TSAAD_E2E: "1" }, hdr(FAKE), REAL)).toBe(REAL);
    expect(resolveNow({ ...base, TSAAD_E2E: "1", APP_ORIGIN: "https://app.example.com" }, hdr(FAKE), REAL)).toBe(REAL);
    expect(resolveNow({ ...base, TSAAD_E2E: "true", APP_ORIGIN: "http://localhost:3100" }, hdr(FAKE), REAL)).toBe(REAL);
    expect(resolveNow({ ...base, TSAAD_E2E: "1", APP_ORIGIN: "http://localhost.evil.com" }, hdr(FAKE), REAL)).toBe(REAL);
    expect(resolveNow({ ...base, ...e2e }, null, REAL).getTime()).toBe(FAKE_UTC);
  });

  it("is ignored on any Vercel deployment, whatever else is set", () => {
    expect(testClockAllowed({ ...e2e, VERCEL: "1" })).toBe(false);
    expect(testClockAllowed({ ...e2e, VERCEL_ENV: "production" })).toBe(false);
    expect(testClockAllowed({ NODE_ENV: "development", VERCEL_ENV: "preview" })).toBe(false);
    expect(resolveNow({ NODE_ENV: "development", VERCEL: "1", [TEST_CLOCK_KEY_ENV]: KEY }, hdr(FAKE), REAL)).toBe(REAL);
  });

  it("the header overrides the env value only with the run key; junk falls back", () => {
    const env = { ...e2e, [TEST_CLOCK_ENV]: "2026-12-01T08:00:00+02:00" };
    const envNow = new Date("2026-12-01T08:00:00+02:00").getTime();
    expect(resolveNow(env, hdr(FAKE), REAL).getTime()).toBe(FAKE_UTC);
    expect(resolveNow(env, hdr("garbage"), REAL).getTime()).toBe(envNow);
    expect(resolveNow(e2e, hdr("2026-12-04"), REAL)).toBe(REAL); // no zone: refused
    expect(resolveNow(e2e, hdr("2026-13-40T99:00:00Z"), REAL)).toBe(REAL);
    expect(resolveNow(e2e, hdr(undefined), REAL)).toBe(REAL);
  });

  it("a spoofed header without the right key is ignored, even with the e2e opt-in", () => {
    expect(resolveNow(e2e, hdr(FAKE, null), REAL)).toBe(REAL);
    expect(resolveNow(e2e, hdr(FAKE, ""), REAL)).toBe(REAL);
    expect(resolveNow(e2e, hdr(FAKE, KEY.slice(1)), REAL)).toBe(REAL);
    expect(resolveNow(e2e, hdr(FAKE, `${KEY}x`), REAL)).toBe(REAL);
    // no key configured, or a short one: the header path is off entirely
    const { [TEST_CLOCK_KEY_ENV]: _omit, ...noKey } = e2e;
    void _omit;
    expect(resolveNow(noKey, hdr(FAKE, ""), REAL)).toBe(REAL);
    expect(resolveNow(noKey, hdr(FAKE, "undefined"), REAL)).toBe(REAL);
    expect(resolveNow({ ...e2e, [TEST_CLOCK_KEY_ENV]: "short" }, hdr(FAKE, "short"), REAL)).toBe(REAL);
    expect(resolveNow({ NODE_ENV: "development" }, hdr(FAKE, ""), REAL)).toBe(REAL);
  });
});
