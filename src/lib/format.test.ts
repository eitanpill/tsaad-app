import { describe, expect, it } from "vitest";
import { fill, formatHeDate, withStartDate } from "./format";

describe("fill", () => {
  it("fills known variables and leaves unknown ones", () => {
    expect(fill("a {x} b {y}", { x: 3 })).toBe("a 3 b {y}");
  });
  it("ignores inherited names such as {constructor}", () => {
    expect(fill("{constructor} {toString}", {})).toBe("{constructor} {toString}");
  });
});

describe("withStartDate", () => {
  it("keeps the placeholder when no start date is configured (no invented date)", () => {
    expect(withStartDate("מתחיל ב־[START_DATE]", undefined)).toBe("מתחיל ב־[START_DATE]");
  });
  it("fills every occurrence with a Hebrew date", () => {
    const out = withStartDate("[START_DATE] ו־[START_DATE]", "2026-12-01");
    expect(out).not.toContain("[START_DATE]");
    expect(out).toContain("1");
  });
});

describe("formatHeDate", () => {
  it("formats a local date in Hebrew, with or without the weekday, independent of the server time zone", () => {
    expect(formatHeDate("2026-11-30")).toBe("30 בנובמבר");
    expect(formatHeDate("2026-11-29", { weekday: true })).toBe("יום ראשון, 29 בנובמבר");
  });
});
