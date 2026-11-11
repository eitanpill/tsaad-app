import { describe, expect, it } from "vitest";
import { checkProductionEnv, EnvConfigError } from "./required";

const base = {
  DATABASE_URL: "postgres://u:p@h/db",
  APP_ORIGIN: "https://app.example",
  SESSION_SECRET: "x".repeat(40),
  ACTIVATION_LINK_TTL_MINUTES: "60",
};

describe("checkProductionEnv", () => {
  it("names every missing required variable, never values", () => {
    expect(() => checkProductionEnv({})).toThrow(EnvConfigError);
    expect(() => checkProductionEnv({ ...base, SESSION_SECRET: "" })).toThrow("Missing required environment variables: SESSION_SECRET");
    expect(() => checkProductionEnv({ APP_ORIGIN: "https://a.example" })).toThrow(
      "DATABASE_URL, SESSION_SECRET, ACTIVATION_LINK_TTL_MINUTES",
    );
  });
  it("rejects invalid values by name without echoing them", () => {
    let msg = "";
    try {
      checkProductionEnv({ ...base, START_DATE: "2026-02-30", APP_ORIGIN: "http://evil.example/secretpath" });
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toContain("START_DATE");
    expect(msg).toContain("APP_ORIGIN");
    expect(msg).not.toContain("secretpath");
  });
  it("warns about recommended and risky settings", () => {
    const w = checkProductionEnv({ ...base, REMINDERS_ENABLED: "true", VERCEL: "1", TSAAD_E2E: "1" });
    expect(w.join("\n")).toContain("CRON_SECRET");
    expect(w.join("\n")).toContain("ACCESSIBILITY_CONTACT");
    expect(w.join("\n")).toContain("without VAPID keys");
    expect(w.join("\n")).toContain("test clock");
  });
});
