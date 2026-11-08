// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addDays, diffDays, getZonedParts, localDate, localMinutes, zonedTimeToInstant } from "./zone";
import { fixedClock } from "./clock";

const iso = (d: Date) => d.toISOString();

describe("local date in Asia/Jerusalem", () => {
  it("uses +2 in winter and +3 in summer", () => {
    expect(localDate(new Date("2026-12-01T21:59:00Z"))).toBe("2026-12-01");
    expect(localDate(new Date("2026-12-01T22:00:00Z"))).toBe("2026-12-02");
    expect(localDate(new Date("2026-07-01T20:59:00Z"))).toBe("2026-07-01");
    expect(localDate(new Date("2026-07-01T21:00:00Z"))).toBe("2026-07-02");
  });
  it("never prints hour 24 at midnight", () => {
    const p = getZonedParts(new Date("2026-12-01T22:00:00Z"));
    expect(p.hour).toBe(0);
    expect(localMinutes(new Date("2026-12-01T22:00:00Z"))).toBe(0);
  });
  it("changes offset at the DST transitions (spring 2026-03-27 02:00, autumn 2026-10-25 02:00)", () => {
    expect(localMinutes(new Date("2026-03-26T23:59:00Z"))).toBe(1 * 60 + 59);
    expect(localMinutes(new Date("2026-03-27T00:00:00Z"))).toBe(3 * 60);
    expect(localMinutes(new Date("2026-10-24T22:59:00Z"))).toBe(1 * 60 + 59);
    expect(localMinutes(new Date("2026-10-24T23:00:00Z"))).toBe(1 * 60); // 01:00 again
  });
  it("rejects invalid instants", () => {
    expect(() => localDate(new Date("nope"))).toThrow();
  });
});

describe("calendar arithmetic", () => {
  it("adds days across month, year and leap boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-03-20", "2026-04-02")).toBe(13);
    expect(() => addDays("2026-02-30", 1)).toThrow();
  });
});

describe("zonedTimeToInstant", () => {
  it("converts wall time to UTC for both offsets", () => {
    expect(iso(zonedTimeToInstant("2026-12-01", "05:00"))).toBe("2026-12-01T03:00:00.000Z");
    expect(iso(zonedTimeToInstant("2026-07-01", "05:00"))).toBe("2026-07-01T02:00:00.000Z");
  });
  it("handles the 23h and 25h days", () => {
    expect(iso(zonedTimeToInstant("2026-03-27", "05:00"))).toBe("2026-03-27T02:00:00.000Z");
    expect(iso(zonedTimeToInstant("2026-03-28", "00:00"))).toBe("2026-03-27T21:00:00.000Z");
    expect(iso(zonedTimeToInstant("2026-10-25", "05:00"))).toBe("2026-10-25T03:00:00.000Z");
    expect(iso(zonedTimeToInstant("2026-10-26", "00:00"))).toBe("2026-10-25T22:00:00.000Z");
  });
  it("picks the first occurrence of an ambiguous time and shifts a missing one", () => {
    expect(iso(zonedTimeToInstant("2026-10-25", "01:30"))).toBe("2026-10-24T22:30:00.000Z");
    expect(iso(zonedTimeToInstant("2026-03-27", "02:30"))).toBe("2026-03-27T00:30:00.000Z");
  });
  it("round-trips through localDate", () => {
    for (const d of ["2026-03-27", "2026-03-28", "2026-10-25", "2027-01-15"]) {
      expect(localDate(zonedTimeToInstant(d, "00:00"))).toBe(d);
      expect(localMinutes(zonedTimeToInstant(d, "00:00"))).toBe(0);
    }
  });
});

describe("fixedClock", () => {
  it("returns a copy of the fixed instant", () => {
    const c = fixedClock("2026-12-01T00:00:00Z");
    expect(iso(c())).toBe("2026-12-01T00:00:00.000Z");
    c().setTime(0);
    expect(iso(c())).toBe("2026-12-01T00:00:00.000Z");
    expect(() => fixedClock("x")).toThrow();
  });
});
