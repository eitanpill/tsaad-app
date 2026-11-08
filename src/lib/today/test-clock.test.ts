import { describe, expect, it } from "vitest";
import { TEST_CLOCK_ENV, resolveNow, testClockAllowed } from "./test-clock";

const REAL = new Date("2030-01-01T00:00:00Z");
const FAKE = "2026-12-04T14:00:00+02:00";
const FAKE_UTC = new Date(FAKE).getTime();
const e2e = { NODE_ENV: "production", TSAAD_E2E: "1", APP_ORIGIN: "http://localhost:3100" };

describe("test clock guard", () => {
  it("is honoured in dev and test", () => {
    expect(resolveNow({ NODE_ENV: "development", [TEST_CLOCK_ENV]: FAKE }, null, REAL).getTime()).toBe(FAKE_UTC);
    expect(resolveNow({ NODE_ENV: "test" }, FAKE, REAL).getTime()).toBe(FAKE_UTC);
  });

  it("is IGNORED in production unless the local e2e opt-in and a loopback origin are both present", () => {
    const base = { NODE_ENV: "production", [TEST_CLOCK_ENV]: FAKE };
    expect(resolveNow(base, FAKE, REAL)).toBe(REAL);
    expect(resolveNow({ ...base, APP_ORIGIN: "https://app.example.com" }, FAKE, REAL)).toBe(REAL);
    expect(resolveNow({ ...base, TSAAD_E2E: "1" }, FAKE, REAL)).toBe(REAL);
    expect(resolveNow({ ...base, TSAAD_E2E: "1", APP_ORIGIN: "https://app.example.com" }, FAKE, REAL)).toBe(REAL);
    expect(resolveNow({ ...base, TSAAD_E2E: "true", APP_ORIGIN: "http://localhost:3100" }, FAKE, REAL)).toBe(REAL);
    expect(resolveNow({ ...base, TSAAD_E2E: "1", APP_ORIGIN: "http://localhost.evil.com" }, FAKE, REAL)).toBe(REAL);
    expect(resolveNow({ ...base, ...e2e }, null, REAL).getTime()).toBe(FAKE_UTC);
  });

  it("is ignored on any Vercel deployment, whatever else is set", () => {
    expect(testClockAllowed({ ...e2e, VERCEL: "1" })).toBe(false);
    expect(testClockAllowed({ ...e2e, VERCEL_ENV: "production" })).toBe(false);
    expect(testClockAllowed({ NODE_ENV: "development", VERCEL_ENV: "preview" })).toBe(false);
    expect(resolveNow({ NODE_ENV: "development", VERCEL: "1" }, FAKE, REAL)).toBe(REAL);
  });

  it("the header overrides the env value; junk falls back", () => {
    const env = { ...e2e, [TEST_CLOCK_ENV]: "2026-12-01T08:00:00+02:00" };
    expect(resolveNow(env, FAKE, REAL).getTime()).toBe(FAKE_UTC);
    expect(resolveNow(env, "garbage", REAL).getTime()).toBe(new Date("2026-12-01T08:00:00+02:00").getTime());
    expect(resolveNow(e2e, "2026-12-04", REAL)).toBe(REAL); // no zone: refused
    expect(resolveNow(e2e, "2026-13-40T99:00:00Z", REAL)).toBe(REAL);
    expect(resolveNow(e2e, undefined, REAL)).toBe(REAL);
  });
});
