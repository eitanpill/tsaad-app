// @vitest-environment node
import { describe, expect, it } from "vitest";
import { dayStatusAt } from "@/lib/days";
import { PREVIEW_TTL_SECONDS, isPreviewDay, signPreviewCookie, verifyPreviewCookie } from "./cookie";
import { previewSchedule } from "./schedule";

const SECRET = "p".repeat(32);
const NOW = Date.parse("2026-11-11T10:00:00Z");

describe("preview cookie", () => {
  it("round-trips for the same user, secret and an unexpired time", () => {
    const { value, maxAge } = signPreviewCookie(SECRET, "u1", 9, NOW);
    expect(maxAge).toBe(PREVIEW_TTL_SECONDS);
    expect(verifyPreviewCookie(SECRET, "u1", value, NOW + 1000)).toBe(9);
  });
  it("is bound to the user and the secret", () => {
    const { value } = signPreviewCookie(SECRET, "u1", 9, NOW);
    expect(verifyPreviewCookie(SECRET, "u2", value, NOW)).toBeNull();
    expect(verifyPreviewCookie("q".repeat(32), "u1", value, NOW)).toBeNull();
  });
  it("rejects a tampered day, expiry or signature, and an expired cookie", () => {
    const { value } = signPreviewCookie(SECRET, "u1", 3, NOW);
    const [v, , exp, sig] = value.split(".");
    expect(verifyPreviewCookie(SECRET, "u1", `${v}.14.${exp}.${sig}`, NOW)).toBeNull();
    expect(verifyPreviewCookie(SECRET, "u1", `${v}.3.${Number(exp) + 99999}.${sig}`, NOW)).toBeNull();
    expect(verifyPreviewCookie(SECRET, "u1", `${v}.3.${exp}.${sig.slice(0, -1)}0`, NOW)).toBeNull();
    expect(verifyPreviewCookie(SECRET, "u1", value, NOW + (PREVIEW_TTL_SECONDS + 1) * 1000)).toBeNull();
  });
  it("rejects garbage, empty and out-of-range days", () => {
    for (const bad of [undefined, "", "x", "v1.1.2", "v2.1.99999999999.abc", "v1.0.99999999999.abc", "v1.15.99999999999.abc", "v1.1.1.1.1", "a".repeat(300)]) {
      expect(verifyPreviewCookie(SECRET, "u1", bad, NOW)).toBeNull();
    }
    expect(() => signPreviewCookie(SECRET, "u1", 0, NOW)).toThrow();
    expect(() => signPreviewCookie(SECRET, "u1", 15, NOW)).toThrow();
    expect(isPreviewDay(1) && isPreviewDay(14) && !isPreviewDay(1.5) && !isPreviewDay("3")).toBe(true);
  });
});

describe("previewSchedule", () => {
  const opts = { timeZone: "Asia/Jerusalem", unlockTime: "05:00" };
  it("makes today day N for every N, with START_DATE unset", () => {
    const now = new Date("2026-11-11T10:00:00Z");
    for (let n = 1; n <= 14; n++) {
      expect(dayStatusAt(now, previewSchedule(now, n, opts))).toEqual({ phase: "active", day: n });
    }
  });
  it("before the 05:00 unlock the challenge date is still yesterday's, and day N still holds", () => {
    const now = new Date("2026-11-11T01:00:00Z"); // 03:00 Israel
    expect(dayStatusAt(now, previewSchedule(now, 5, opts))).toEqual({ phase: "active", day: 5 });
  });
});
