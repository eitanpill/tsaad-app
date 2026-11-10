import { describe, expect, it } from "vitest";
import { isInvalidDayPath, parseDayParam } from "./day-param";

describe("parseDayParam", () => {
  it("accepts 1..14 written plainly", () => {
    for (let d = 1; d <= 14; d++) expect(parseDayParam(String(d))).toBe(d);
  });
  it("rejects everything else", () => {
    for (const bad of ["0", "15", "07", "7.0", "1e1", "+7", "-1", " 7", "7 ", "٣", "0x7", "99999999999999999999", "", "abc"]) {
      expect(parseDayParam(bad), bad).toBeNull();
    }
  });
});

describe("isInvalidDayPath (proxy: real 404 before rendering)", () => {
  it("valid days pass, including a percent-encoded digit and a trailing slash", () => {
    for (const p of ["/day/1", "/day/14", "/day/%37", "/day/%31%30", "/day/3/"]) expect(isInvalidDayPath(p), p).toBe(false);
  });
  it("invalid day segments are caught", () => {
    for (const p of ["/day/0", "/day/15", "/day/07", "/day/7.0", "/day/1e1", "/day/-1", "/day/abc", "/day/%20", "/day/%E0%A4%A", "/day/%2537"]) {
      expect(isInvalidDayPath(p), p).toBe(true);
    }
  });
  it("other paths are not its business", () => {
    for (const p of ["/day", "/day/", "/today", "/path", "/days/3", "/day/3/x", "/dayx/3"]) expect(isInvalidDayPath(p), p).toBe(false);
  });
});
