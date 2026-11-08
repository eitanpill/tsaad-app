// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ACTIONS, actionsForDay, canMark, computeProgress, cupLevel, dayCounts, dayDate,
  dayStatusAt, isDayUnlocked, makeSchedule, markDeadline, markState, reminderDue,
  stepsFor, unlockedDays, unlockInstant,
} from ".";

const at = (s: string) => new Date(s);
const winter = makeSchedule("2026-12-01"); // IST +2 all challenge long
const spring = makeSchedule("2026-03-20"); // DST starts Fri 2026-03-27 02:00 (day 8)
const autumn = makeSchedule("2026-10-18"); // DST ends Sun 2026-10-25 02:00 (day 8)

describe("day number and unlock (05:00 Asia/Jerusalem)", () => {
  it("before start, boundaries, and after end", () => {
    expect(dayStatusAt(at("2026-12-01T02:59:00Z"), winter)).toEqual({ phase: "before_start" });
    expect(dayStatusAt(at("2026-12-01T03:00:00Z"), winter)).toEqual({ phase: "active", day: 1 });
    expect(dayStatusAt(at("2026-12-02T02:59:59Z"), winter)).toEqual({ phase: "active", day: 1 });
    expect(dayStatusAt(at("2026-12-02T03:00:00Z"), winter)).toEqual({ phase: "active", day: 2 });
    expect(dayStatusAt(at("2026-12-15T02:59:59Z"), winter)).toEqual({ phase: "active", day: 14 });
    expect(dayStatusAt(at("2026-12-15T03:00:00Z"), winter)).toEqual({ phase: "ended" });
    expect(dayStatusAt(at("2027-06-01T00:00:00Z"), winter)).toEqual({ phase: "ended" });
  });
  it("00:00-05:00 local still belongs to the previous day", () => {
    // 2026-12-03 00:30 local = 22:30Z on the 2nd
    expect(dayStatusAt(at("2026-12-02T22:30:00Z"), winter)).toEqual({ phase: "active", day: 2 });
  });
  it("unlockedDays and isDayUnlocked", () => {
    expect(unlockedDays(at("2026-11-30T12:00:00Z"), winter)).toEqual([]);
    expect(unlockedDays(at("2026-12-03T12:00:00Z"), winter)).toEqual([1, 2, 3]);
    expect(unlockedDays(at("2027-01-01T12:00:00Z"), winter)).toHaveLength(14);
    expect(isDayUnlocked(2, at("2026-12-02T02:59:59Z"), winter)).toBe(false);
    expect(isDayUnlocked(2, at("2026-12-02T03:00:00Z"), winter)).toBe(true);
    expect(() => isDayUnlocked(15, new Date(), winter)).toThrow();
    expect(dayDate(14, winter)).toBe("2026-12-14");
  });
  it("DST start: unlock stays 05:00 local (day 8 unlocks at 02:00Z)", () => {
    expect(unlockInstant(7, spring).toISOString()).toBe("2026-03-26T03:00:00.000Z");
    expect(unlockInstant(8, spring).toISOString()).toBe("2026-03-27T02:00:00.000Z");
    expect(dayStatusAt(at("2026-03-27T01:59:00Z"), spring)).toEqual({ phase: "active", day: 7 });
    expect(dayStatusAt(at("2026-03-27T02:00:00Z"), spring)).toEqual({ phase: "active", day: 8 });
    expect(dayStatusAt(at("2026-03-28T01:59:00Z"), spring)).toEqual({ phase: "active", day: 8 });
    expect(dayStatusAt(at("2026-03-28T02:00:00Z"), spring)).toEqual({ phase: "active", day: 9 });
  });
  it("DST end: day 8 unlocks at 03:00Z, 25-hour calendar day", () => {
    expect(unlockInstant(7, autumn).toISOString()).toBe("2026-10-24T02:00:00.000Z");
    expect(unlockInstant(8, autumn).toISOString()).toBe("2026-10-25T03:00:00.000Z");
    expect(dayStatusAt(at("2026-10-25T02:59:00Z"), autumn)).toEqual({ phase: "active", day: 7 });
    expect(dayStatusAt(at("2026-10-25T03:00:00Z"), autumn)).toEqual({ phase: "active", day: 8 });
    // the repeated 01:00-02:00 hour does not confuse it
    expect(dayStatusAt(at("2026-10-24T23:30:00Z"), autumn)).toEqual({ phase: "active", day: 7 });
  });
  it("challenge starting right at a DST change still starts at 05:00", () => {
    const s = makeSchedule("2026-03-27");
    expect(unlockInstant(1, s).toISOString()).toBe("2026-03-27T02:00:00.000Z");
    expect(dayStatusAt(at("2026-03-27T01:59:00Z"), s)).toEqual({ phase: "before_start" });
  });
});

describe("marking rule: current day, yesterday until 24:00, older closed", () => {
  it("locked before unlock", () => {
    expect(markState(2, at("2026-12-02T02:59:59Z"), winter)).toEqual({ ok: false, reason: "locked" });
    expect(markState(1, at("2026-12-01T02:59:59Z"), winter)).toEqual({ ok: false, reason: "locked" });
  });
  it("current day is markable all day, kind=current", () => {
    const r = markState(1, at("2026-12-01T03:00:00Z"), winter);
    expect(r).toMatchObject({ ok: true, kind: "current" });
  });
  it("yesterday opens at 05:00 (day N+1 unlock) and closes at 00:00 of D(N)+2", () => {
    // day 1, D=Dec 1. Yesterday from Dec 2 05:00 (03:00Z) until Dec 3 00:00 (Dec 2 22:00Z)
    expect(markState(1, at("2026-12-02T03:00:00Z"), winter)).toMatchObject({ ok: true, kind: "yesterday" });
    expect(markState(1, at("2026-12-02T21:59:59Z"), winter)).toMatchObject({ ok: true, kind: "yesterday" });
    expect(markState(1, at("2026-12-02T22:00:00Z"), winter)).toEqual({ ok: false, reason: "closed" });
    expect(markDeadline(1, winter).toISOString()).toBe("2026-12-02T22:00:00.000Z");
  });
  it("00:00-05:00 window: only the current day is markable, yesterday-to-be is closed", () => {
    // Dec 3 00:00 local = Dec 2 22:00Z; Dec 3 04:59:59 local = Dec 3 02:59:59Z
    for (const t of ["2026-12-02T22:00:00Z", "2026-12-03T00:00:00Z", "2026-12-03T02:59:59Z"]) {
      expect(dayStatusAt(at(t), winter)).toEqual({ phase: "active", day: 2 });
      expect(markState(1, at(t), winter)).toEqual({ ok: false, reason: "closed" });
      expect(markState(2, at(t), winter)).toMatchObject({ ok: true, kind: "current" });
      expect(markState(3, at(t), winter)).toEqual({ ok: false, reason: "locked" });
    }
    // 00:00-05:00 before the midnight: day 1 is still current
    expect(markState(1, at("2026-12-01T22:00:00Z"), winter)).toMatchObject({ ok: true, kind: "current" });
  });
  it("closesAt is the midnight deadline", () => {
    const r = markState(3, at("2026-12-03T10:00:00Z"), winter);
    expect(r.ok && r.closesAt.toISOString()).toBe("2026-12-04T22:00:00.000Z");
  });
  it("day 14 stays markable until 00:00 after the calendar day following it", () => {
    // D(14)=Dec 14; ended at Dec 15 05:00; markable until Dec 16 00:00 = Dec 15 22:00Z
    expect(markState(14, at("2026-12-15T02:59:59Z"), winter)).toMatchObject({ ok: true, kind: "current" });
    expect(markState(14, at("2026-12-15T03:00:00Z"), winter)).toMatchObject({ ok: true, kind: "yesterday" });
    expect(markState(14, at("2026-12-15T21:59:59Z"), winter)).toMatchObject({ ok: true, kind: "yesterday" });
    expect(markState(14, at("2026-12-15T22:00:00Z"), winter)).toEqual({ ok: false, reason: "closed" });
    expect(canMark(13, at("2026-12-15T10:00:00Z"), winter)).toBe(false);
  });
  it("DST start: the 23h day and its deadlines", () => {
    // day 7 (Mar 26) closes Mar 28 00:00 IDT = Mar 27 21:00Z
    expect(markDeadline(7, spring).toISOString()).toBe("2026-03-27T21:00:00.000Z");
    expect(canMark(7, at("2026-03-27T20:59:59Z"), spring)).toBe(true);
    expect(canMark(7, at("2026-03-27T21:00:00Z"), spring)).toBe(false);
    // day 6 (Mar 25) closes Mar 27 00:00 IST = Mar 26 22:00Z
    expect(markDeadline(6, spring).toISOString()).toBe("2026-03-26T22:00:00.000Z");
    expect(canMark(6, at("2026-03-26T21:59:59Z"), spring)).toBe(true);
    expect(canMark(6, at("2026-03-26T22:00:00Z"), spring)).toBe(false);
  });
  it("DST end: the 25h day and its deadlines", () => {
    // day 7 (Oct 24) closes Oct 26 00:00 IST = Oct 25 22:00Z
    expect(markDeadline(7, autumn).toISOString()).toBe("2026-10-25T22:00:00.000Z");
    expect(canMark(7, at("2026-10-25T21:59:59Z"), autumn)).toBe(true);
    expect(canMark(7, at("2026-10-25T22:00:00Z"), autumn)).toBe(false);
    // day 6 (Oct 23) closes Oct 25 00:00 IDT = Oct 24 21:00Z
    expect(markDeadline(6, autumn).toISOString()).toBe("2026-10-24T21:00:00.000Z");
  });
});

describe("cup", () => {
  it("normal day: habit/move/meditate, one step each", () => {
    expect(actionsForDay(3)).toEqual(["habit", "move", "meditate"]);
    expect(stepsFor(3, [])).toBe(0);
    expect(stepsFor(3, ["habit"])).toBe(1);
    expect(stepsFor(3, ["habit", "move"])).toBe(2);
    expect(stepsFor(3, ["habit", "move", "meditate"])).toBe(3);
  });
  it("live days (7, 14): habit + live, live counts as two", () => {
    for (const d of [7, 14]) {
      expect(actionsForDay(d)).toEqual(["habit", "live"]);
      expect(stepsFor(d, ["live"])).toBe(2);
      expect(stepsFor(d, ["habit"])).toBe(1);
      expect(stepsFor(d, ["habit", "live"])).toBe(3);
      expect(stepsFor(d, ["move", "meditate"])).toBe(0); // not valid on live days
    }
    expect(stepsFor(3, ["live"])).toBe(0); // live not valid on a normal day
  });
  it("ignores duplicates, caps at 3, maps to levels", () => {
    expect(stepsFor(3, ["habit", "habit", "habit"])).toBe(1);
    expect(["empty", "half", "three_quarters", "full"]).toEqual([0, 1, 2, 3].map(cupLevel));
    expect(cupLevel(9)).toBe("full");
    expect(cupLevel(-1)).toBe("empty");
    expect(ACTIONS).toContain("live");
  });
  it("a day counts from one step", () => {
    expect(dayCounts(0)).toBe(false);
    expect(dayCounts(1)).toBe(true);
  });
});

describe("completion (12 of 14) and reachability", () => {
  const steps = (days: number[]) => Object.fromEntries(days.map((d) => [d, 1]));
  it("remaining and completed", () => {
    const now = at("2026-12-10T10:00:00Z"); // day 10
    const p = computeProgress(steps([1, 2, 3, 4, 5]), now, winter);
    expect(p).toMatchObject({ counted: 5, remaining: 7, completed: false });
    const done = computeProgress(steps([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), now, winter);
    expect(done).toMatchObject({ counted: 12, remaining: 0, completed: true, isCompletionReachable: true });
  });
  it("zero-step days do not count", () => {
    const p = computeProgress({ 1: 0, 2: 0 }, at("2026-12-03T10:00:00Z"), winter);
    expect(p.counted).toBe(0);
  });
  it("boundary of reachability with nothing counted", () => {
    // day 3: days 2,3 markable + 11 locked = 13 >= 12
    expect(computeProgress({}, at("2026-12-03T10:00:00Z"), winter)).toMatchObject({ daysLeft: 13, isCompletionReachable: true });
    // day 4: day 3,4 markable + 10 locked = 12 -> still reachable
    expect(computeProgress({}, at("2026-12-04T10:00:00Z"), winter)).toMatchObject({ daysLeft: 12, isCompletionReachable: true });
    // day 5: 11 -> unreachable
    expect(computeProgress({}, at("2026-12-05T10:00:00Z"), winter)).toMatchObject({ daysLeft: 11, isCompletionReachable: false });
  });
  it("yesterday backfill keeps it reachable until midnight, then not", () => {
    // day 5 morning, days 1-3 counted + day 4 missing: counted 3. days left: 4,5 + 9 locked = 11 -> 14 >= 12
    const s = steps([1, 2, 3]);
    expect(computeProgress(s, at("2026-12-05T10:00:00Z"), winter).isCompletionReachable).toBe(true);
    // day 8 (Dec 8) 10:00: counted 3, days left 7,8 + 6 locked = 8 -> 11 < 12
    expect(computeProgress(s, at("2026-12-08T10:00:00Z"), winter).isCompletionReachable).toBe(false);
    // boundary: counted 6 on day 9: left 8,9 + 5 locked = 7 -> 13 ok. counted 4 on day 9: 11 -> no
    expect(computeProgress(steps([1, 2, 3, 4]), at("2026-12-09T10:00:00Z"), winter).isCompletionReachable).toBe(false);
    expect(computeProgress(steps([1, 2, 3, 4, 5]), at("2026-12-09T10:00:00Z"), winter).isCompletionReachable).toBe(true);
  });
  it("day 14 end: 11 counted can still reach 12 until the deadline, not after", () => {
    const s = steps([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(computeProgress(s, at("2026-12-14T10:00:00Z"), winter)).toMatchObject({ remaining: 1, isCompletionReachable: true });
    // Dec 15 21:59Z: ended but day 14 still markable (yesterday)
    expect(computeProgress(s, at("2026-12-15T21:59:00Z"), winter).isCompletionReachable).toBe(true);
    expect(computeProgress(s, at("2026-12-15T22:00:00Z"), winter)).toMatchObject({ daysLeft: 0, isCompletionReachable: false });
  });
});

describe("reminderDue", () => {
  const base = { timeZone: "Asia/Jerusalem", reminderTime: "07:30" };
  it("not before 07:30 local, due at the first run at or after, once per date", () => {
    expect(reminderDue({ ...base, now: at("2026-12-02T05:29:59Z"), alreadyHandledDates: [] })).toEqual({ due: false, reason: "too_early" });
    expect(reminderDue({ ...base, now: at("2026-12-02T05:30:00Z"), alreadyHandledDates: [] })).toEqual({ due: true, date: "2026-12-02" });
    // late cron run still fires
    expect(reminderDue({ ...base, now: at("2026-12-02T09:12:00Z"), alreadyHandledDates: ["2026-12-01"] })).toEqual({ due: true, date: "2026-12-02" });
    expect(reminderDue({ ...base, now: at("2026-12-02T09:12:00Z"), alreadyHandledDates: ["2026-12-02"] })).toEqual({ due: false, reason: "already_handled" });
  });
  it("is DST safe (07:30 is 04:30Z in summer, 05:30Z in winter)", () => {
    expect(reminderDue({ ...base, now: at("2026-07-02T04:29:00Z"), alreadyHandledDates: [] }).due).toBe(false);
    expect(reminderDue({ ...base, now: at("2026-07-02T04:30:00Z"), alreadyHandledDates: [] }).due).toBe(true);
  });
  it("honours an optional cutoff", () => {
    expect(reminderDue({ ...base, cutoffTime: "12:00", now: at("2026-12-02T10:00:00Z"), alreadyHandledDates: [] })).toEqual({ due: false, reason: "past_cutoff" });
  });
  it("uses the local date, not UTC (00:30 local is the previous UTC date)", () => {
    expect(reminderDue({ ...base, now: at("2026-12-01T22:30:00Z"), alreadyHandledDates: [] })).toEqual({ due: false, reason: "too_early" });
  });
});

describe("marking invariants (security review sweep, every 10 minutes incl. DST)", () => {
  for (const [name, s] of [["winter", winter], ["spring", spring], ["autumn", autumn]] as const) {
    it(`${name}: never a future/locked day, never older than yesterday, at most two open`, () => {
      const startMs = unlockInstant(1, s).getTime() - 2 * 86_400_000;
      const endMs = unlockInstant(14, s).getTime() + 3 * 86_400_000;
      for (let t = startMs; t <= endMs; t += 10 * 60_000) {
        const now = new Date(t);
        const st = dayStatusAt(now, s);
        const open: number[] = [];
        for (let d = 1; d <= 14; d++) {
          if (!canMark(d, now, s)) continue;
          open.push(d);
          expect(now.getTime()).toBeGreaterThanOrEqual(unlockInstant(d, s).getTime());
          expect(now.getTime()).toBeLessThan(markDeadline(d, s).getTime());
        }
        expect(open.length).toBeLessThanOrEqual(2);
        if (st.phase === "before_start") expect(open).toEqual([]);
        if (st.phase === "active") {
          for (const d of open) expect([st.day, st.day - 1]).toContain(d);
        }
        if (st.phase === "ended") for (const d of open) expect(d).toBe(14);
      }
    });
  }
});
