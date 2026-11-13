import { describe, expect, it } from "vitest";
import { LIVE, LIVE_REMINDER } from "@/config/constants";
import { makeSchedule } from "@/lib/days";
import { dueLiveReminders, liveReminderDue } from "./reminder";
import { liveSession } from "./model";

const at = (iso: string) => new Date(iso);
// START 2026-12-01 (Israel winter, +02:00): day 7 = 2026-12-07, day 14 = 2026-12-14.
const winter = makeSchedule("2026-12-01");
const T = { 7: { time: "20:00" }, 14: { time: "19:30" } };

describe("live reminder lead time", () => {
  it("is the same hour as when the link opens in the app", () => {
    expect(LIVE_REMINDER.leadMinutes).toBe(LIVE.linkOpensBeforeMinutes);
    expect(LIVE_REMINDER.leadMinutes).toBe(60);
  });
});

describe("liveReminderDue (start - 60 min, until the start)", () => {
  const start = at("2026-12-07T20:00:00+02:00");
  it("is not due one millisecond before start-60", () => {
    expect(liveReminderDue(at("2026-12-07T18:59:59.999+02:00"), start)).toBe(false);
  });
  it("is due exactly at start-60 (the boundary, inclusive)", () => {
    expect(liveReminderDue(at("2026-12-07T19:00:00+02:00"), start)).toBe(true);
  });
  it("is due between start-60 and the start (a 15 minute cron lands 45 to 60 minutes before)", () => {
    expect(liveReminderDue(at("2026-12-07T19:15:00+02:00"), start)).toBe(true);
    expect(liveReminderDue(at("2026-12-07T19:59:59+02:00"), start)).toBe(true);
  });
  it("is never due at or after the start (a late run skips)", () => {
    expect(liveReminderDue(at("2026-12-07T20:00:00+02:00"), start)).toBe(false);
    expect(liveReminderDue(at("2026-12-07T20:15:00+02:00"), start)).toBe(false);
  });
  it("is not due without a start", () => {
    expect(liveReminderDue(at("2026-12-07T19:30:00+02:00"), null)).toBe(false);
  });
  it("matches the moment the link opens in the app", () => {
    const s = liveSession(7, at("2026-12-07T19:00:00+02:00"), winter, T[7]);
    expect(s.state).toBe("open");
    expect(liveReminderDue(at("2026-12-07T19:00:00+02:00"), s.startsAt)).toBe(true);
    const before = liveSession(7, at("2026-12-07T18:59:59+02:00"), winter, T[7]);
    expect(before.state).toBe("before");
    expect(liveReminderDue(at("2026-12-07T18:59:59+02:00"), before.startsAt)).toBe(false);
  });
});

describe("dueLiveReminders", () => {
  it("returns day 7 with its local date and time inside the window", () => {
    const r = dueLiveReminders(at("2026-12-07T19:20:00+02:00"), winter, T);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ day: 7, date: "2026-12-07", time: "20:00" });
    expect(r[0].startsAt.toISOString()).toBe(at("2026-12-07T20:00:00+02:00").toISOString());
  });
  it("returns day 14 on day 14", () => {
    expect(dueLiveReminders(at("2026-12-14T18:45:00+02:00"), winter, T).map((r) => r.day)).toEqual([14]);
  });
  it("returns nothing on other days, even at the same clock time", () => {
    for (const d of ["2026-12-06", "2026-12-08", "2026-12-13", "2026-12-01"]) {
      expect(dueLiveReminders(at(`${d}T19:20:00+02:00`), winter, T)).toEqual([]);
    }
  });
  it("returns nothing after the start (late run)", () => {
    expect(dueLiveReminders(at("2026-12-07T20:05:00+02:00"), winter, T)).toEqual([]);
  });
  it("returns nothing when that day's live time is not configured (never invents one)", () => {
    expect(dueLiveReminders(at("2026-12-07T19:20:00+02:00"), winter, { 7: {}, 14: T[14] })).toEqual([]);
    expect(dueLiveReminders(at("2026-12-14T19:00:00+02:00"), winter, { 7: T[7], 14: {} })).toEqual([]);
  });
  it("returns nothing without a schedule (START_DATE unset)", () => {
    expect(dueLiveReminders(at("2026-12-07T19:20:00+02:00"), null, T)).toEqual([]);
  });

  describe("DST", () => {
    // Israel: summer time ends Sunday 2026-10-25 (+03:00 to +02:00); starts Friday 2027-03-26 (+02:00 to +03:00).
    it("day 7 on the day summer time ends: start 20:00 is +02:00, the window opens 19:00 local", () => {
      const s = makeSchedule("2026-10-19");
      expect(dueLiveReminders(at("2026-10-25T18:59:00+02:00"), s, T)).toEqual([]);
      const r = dueLiveReminders(at("2026-10-25T19:00:00+02:00"), s, T);
      expect(r[0]).toMatchObject({ day: 7, date: "2026-10-25" });
      expect(r[0].startsAt.toISOString()).toBe("2026-10-25T18:00:00.000Z");
      expect(dueLiveReminders(at("2026-10-25T20:00:00+02:00"), s, T)).toEqual([]);
    });
    it("day 7 on the day summer time starts: start 20:00 is +03:00, the window opens 19:00 local", () => {
      const s = makeSchedule("2027-03-20");
      expect(dueLiveReminders(at("2027-03-26T18:59:00+03:00"), s, T)).toEqual([]);
      const r = dueLiveReminders(at("2027-03-26T19:00:00+03:00"), s, T);
      expect(r[0]).toMatchObject({ day: 7, date: "2027-03-26" });
      expect(r[0].startsAt.toISOString()).toBe("2027-03-26T17:00:00.000Z");
      expect(dueLiveReminders(at("2027-03-26T20:00:00+03:00"), s, T)).toEqual([]);
    });
    it("an early live time right after the clock change still sends exactly one hour before", () => {
      const s = makeSchedule("2027-03-20");
      const early = { 7: { time: "06:00" }, 14: T[14] };
      expect(dueLiveReminders(at("2027-03-26T04:59:00+03:00"), s, early)).toEqual([]);
      expect(dueLiveReminders(at("2027-03-26T05:00:00+03:00"), s, early)).toHaveLength(1);
    });
  });
});
