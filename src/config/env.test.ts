// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";
import { buildConfig } from "./index";

describe("parseEnv", () => {
  it("accepts an empty environment with safe defaults", () => {
    const e = parseEnv({});
    expect(e.TRACKER_SYNC_ENABLED).toBe(false);
    expect(e.REMINDERS_ENABLED).toBe(false);
    expect(e.TZ_NAME).toBe("Asia/Jerusalem");
    expect(e.UNLOCK_HOUR).toBe("05:00");
    expect(e.REMINDER_TIME).toBe("07:30");
    expect(e.START_DATE).toBeUndefined();
    expect(e.SESSION_SPOTS).toBeUndefined();
  });

  it("treats empty strings as unset", () => {
    const e = parseEnv({ START_DATE: "", LIVE_URL_DAY7: "", TZ_NAME: "", SESSION_SPOTS: "" });
    expect(e.START_DATE).toBeUndefined();
    expect(e.LIVE_URL_DAY7).toBeUndefined();
    expect(e.TZ_NAME).toBe("Asia/Jerusalem");
    expect(e.SESSION_SPOTS).toBeUndefined();
  });

  it("parses booleans only from the literal 'true'", () => {
    for (const v of ["false", "1", "TRUE", "True", "yes", " true", ""]) {
      expect(parseEnv({ REMINDERS_ENABLED: v }).REMINDERS_ENABLED).toBe(false);
    }
    expect(parseEnv({ REMINDERS_ENABLED: "true" }).REMINDERS_ENABLED).toBe(true);
    expect(parseEnv({ TRACKER_SYNC_ENABLED: "true" }).TRACKER_SYNC_ENABLED).toBe(true);
  });

  it("validates dates and times", () => {
    expect(parseEnv({ START_DATE: "2026-12-01" }).START_DATE).toBe("2026-12-01");
    expect(() => parseEnv({ START_DATE: "2026-02-30" })).toThrow(/START_DATE/);
    expect(() => parseEnv({ START_DATE: "01/12/2026" })).toThrow();
    expect(() => parseEnv({ LIVE_TIME_DAY7: "25:00" })).toThrow(/LIVE_TIME_DAY7/);
    expect(parseEnv({ LIVE_TIME_DAY14: "20:30" }).LIVE_TIME_DAY14).toBe("20:30");
    expect(() => parseEnv({ TZ_NAME: "Mars/Base" })).toThrow(/TZ_NAME/);
  });

  it("validates urls, origin and numbers", () => {
    expect(() => parseEnv({ APP_ORIGIN: "https://x.example/" })).toThrow(/APP_ORIGIN/);
    expect(parseEnv({ APP_ORIGIN: "https://x.example" }).APP_ORIGIN).toBe("https://x.example");
    expect(() => parseEnv({ LIVE_URL_DAY7: "javascript:alert(1)" })).toThrow();
    expect(() => parseEnv({ LIVE_URL_DAY7: "http://zoom.example/j/1" })).toThrow(/LIVE_URL_DAY7/);
    expect(() => parseEnv({ GHL_WEBHOOK_URL: "http://hooks.example/x" })).toThrow(/GHL_WEBHOOK_URL/);
    expect(parseEnv({ GHL_WEBHOOK_URL: "https://hooks.example/x" }).GHL_WEBHOOK_URL).toBe("https://hooks.example/x");
    expect(() => parseEnv({ APP_ORIGIN: "http://x.example" })).toThrow(/APP_ORIGIN/);
    expect(parseEnv({ APP_ORIGIN: "http://localhost:3000" }).APP_ORIGIN).toBe("http://localhost:3000");
    expect(parseEnv({ SESSION_SPOTS: "30" }).SESSION_SPOTS).toBe(30);
    expect(() => parseEnv({ ACTIVATION_LINK_TTL_MINUTES: "0" })).toThrow();
    expect(() => parseEnv({ OFFER_WINDOW_HOURS: "abc" })).toThrow();
    expect(() => parseEnv({ SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
  });

  it("does not leak values in error messages", () => {
    expect(() => parseEnv({ SESSION_SECRET: "tooshort" })).toThrow();
    try {
      parseEnv({ SESSION_SECRET: "tooshort", GHL_WEBHOOK_URL: "http://user:pw@hooks.example/secretpath" });
    } catch (e) {
      expect(String(e)).not.toContain("tooshort");
      expect(String(e)).not.toContain("secretpath");
    }
  });
});

describe("buildConfig", () => {
  it("is frozen and carries the challenge constants", () => {
    const c = buildConfig({ START_DATE: "2026-12-01" });
    expect(Object.isFrozen(c)).toBe(true);
    expect(Object.isFrozen(c.env)).toBe(true);
    expect(c.challenge.totalDays).toBe(14);
    expect(c.challenge.daysToComplete).toBe(12);
    expect([...c.challenge.liveDays]).toEqual([7, 14]);
    expect(c.unlockTime).toBe("05:00");
    expect(c.reminderTime).toBe("07:30");
    expect(c.startDate).toBe("2026-12-01");
  });
});
