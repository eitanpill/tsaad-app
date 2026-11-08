import { describe, expect, it } from "vitest";
import { makeSchedule } from "@/lib/days";
import { greetingKey, isMorning, nextBoundary, todayModel } from "./view";

const s = makeSchedule("2026-12-01");
const at = (iso: string) => new Date(iso);

describe("today view model", () => {
  it("no schedule or before start", () => {
    expect(todayModel(at("2026-12-01T00:00:00Z"), null).phase).toBe("before_start");
    expect(todayModel(at("2026-11-30T12:00:00+02:00"), s).phase).toBe("before_start");
  });
  it("day 1 from 05:00 and live days", () => {
    expect(todayModel(at("2026-12-01T04:59:00+02:00"), s).phase).toBe("before_start");
    const m = todayModel(at("2026-12-01T05:00:00+02:00"), s);
    expect(m).toMatchObject({ phase: "active", day: 1, live: false, yesterday: null });
    expect(todayModel(at("2026-12-07T10:00:00+02:00"), s)).toMatchObject({ day: 7, live: true, yesterday: 6 });
  });
  it("yesterday only until midnight", () => {
    expect(todayModel(at("2026-12-04T23:59:00+02:00"), s).yesterday).toBe(3);
    expect(todayModel(at("2026-12-05T00:00:00+02:00"), s).yesterday).toBeNull();
    expect(todayModel(at("2026-12-05T06:00:00+02:00"), s)).toMatchObject({ day: 5, yesterday: 4 });
  });
  it("after the end, day 14 stays markable until midnight", () => {
    expect(todayModel(at("2026-12-15T10:00:00+02:00"), s)).toMatchObject({ phase: "ended", day: null, yesterday: 14 });
    expect(todayModel(at("2026-12-16T00:00:00+02:00"), s)).toMatchObject({ phase: "ended", yesterday: null });
  });
  it("greeting and hero by local hour (server clock, Israel time)", () => {
    expect(greetingKey(at("2026-12-04T08:00:00+02:00"), s.timeZone)).toBe("morning");
    expect(greetingKey(at("2026-12-04T14:00:00+02:00"), s.timeZone)).toBe("day");
    expect(greetingKey(at("2026-12-04T21:00:00+02:00"), s.timeZone)).toBe("evening");
    expect(isMorning(at("2026-12-04T11:59:00+02:00"), s.timeZone)).toBe(true);
    expect(isMorning(at("2026-12-04T12:00:00+02:00"), s.timeZone)).toBe(false);
    // the same instant in UTC, read in Jerusalem
    expect(isMorning(at("2026-12-04T09:00:00Z"), s.timeZone)).toBe(true);
  });
  it("next boundary is the next unlock or window close", () => {
    expect(nextBoundary(at("2026-12-04T10:00:00+02:00"), s)!.toISOString()).toBe(at("2026-12-05T00:00:00+02:00").toISOString());
    expect(nextBoundary(at("2026-12-05T00:30:00+02:00"), s)!.toISOString()).toBe(at("2026-12-05T05:00:00+02:00").toISOString());
    expect(nextBoundary(at("2026-12-20T00:00:00+02:00"), s)).toBeNull();
  });
});
