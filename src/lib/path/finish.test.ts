import { describe, expect, it } from "vitest";
import { daysFromMask, finishSummary } from "./finish";

describe("finishSummary", () => {
  it("lists counted days, the mask and the cup totals", () => {
    const s = finishSummary({ 1: 3, 2: 2, 3: 1, 4: 0, 14: 3 });
    expect(s.countedDays).toEqual([1, 2, 3, 14]);
    expect(s.cups).toEqual({ full: 2, threeQuarters: 1, half: 1 });
    expect(s.mask).toBe(1 | 2 | 4 | (1 << 13));
  });
  it("is empty without steps", () => {
    expect(finishSummary({})).toEqual({ countedDays: [], mask: 0, cups: { full: 0, threeQuarters: 0, half: 0 } });
  });
});

describe("daysFromMask", () => {
  it("round-trips with finishSummary", () => {
    const s = finishSummary({ 1: 1, 5: 2, 9: 3, 14: 1 });
    expect(daysFromMask(String(s.mask))).toEqual(s.countedDays);
  });
  it("rejects anything that is not a 14-bit integer", () => {
    for (const bad of [null, "", "-1", "16384", "1.5", "abc", "1e3", "00000007x", "999999"]) expect(daysFromMask(bad)).toBeNull();
    expect(daysFromMask("0")).toEqual([]);
    expect(daysFromMask("16383")).toHaveLength(14);
  });
});
