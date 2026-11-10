import { describe, expect, it } from "vitest";
import { makeSchedule } from "@/lib/days";
import { dayScreen, fillForSteps, parseDayParam, pathModel, stoneState } from "./view";

// יום N נפתח ב־05:00 (שעון ישראל, +02:00 בחורף) בתאריך 2026-12-N.
const s = makeSchedule("2026-12-01");
const at = (iso: string) => new Date(iso);
const states = (now: Date, steps: Record<number, number> = {}) =>
  pathModel(now, s, steps).stones.map((x) => x.state);

describe("stone state", () => {
  it("before start and without a schedule: everything locked, nothing counted", () => {
    const m = pathModel(at("2026-11-30T12:00:00+02:00"), s, {});
    expect(m.stones.every((x) => x.state === "locked")).toBe(true);
    expect(m.counted).toBe(0);
    expect(m.tomorrow).toBeNull();
    expect(m.stones.every((x) => x.href === null)).toBe(true);
    const none = pathModel(at("2026-12-04T12:00:00+02:00"), null, { 1: 3 });
    expect(none.stones.every((x) => x.state === "locked")).toBe(true);
    expect(none.counted).toBe(0);
  });

  it("day 1 at 04:59 is still locked, at 05:00 it is today", () => {
    expect(states(at("2026-12-01T04:59:00+02:00"))[0]).toBe("locked");
    const m = pathModel(at("2026-12-01T05:00:00+02:00"), s, {});
    expect(m.stones[0]).toMatchObject({ state: "today", href: "/today" });
    expect(m.stones[1]).toMatchObject({ state: "locked", href: "/day/2" });
    expect(m.stones[2]).toMatchObject({ state: "locked", href: null });
  });

  it("mid challenge: counted, yesterday markable, missed older, today, locked", () => {
    // יום 5, 10:00. יום 4 = אתמול (לא סומן), יום 3 סומן, יום 2 לא סומן (נסגר), יום 1 סומן.
    const st = states(at("2026-12-05T10:00:00+02:00"), { 1: 1, 3: 2 });
    expect(st.slice(0, 7)).toEqual(["counted", "missed", "counted", "yesterday", "today", "locked", "locked"]);
  });

  it("a marked yesterday is counted, not yesterday", () => {
    expect(states(at("2026-12-05T10:00:00+02:00"), { 4: 1 })[3]).toBe("counted");
  });

  it("midnight boundary: yesterday closes at 00:00 of the next date", () => {
    // 2026-12-05 23:59: יום 4 עדיין אתמול (ו־5 היום). ב־2026-12-06 00:00 יום 4 נסגר, יום 5 הופך ל"אתמול".
    const before = states(at("2026-12-05T23:59:00+02:00"));
    expect(before.slice(3, 5)).toEqual(["yesterday", "today"]);
    const after = states(at("2026-12-06T00:00:00+02:00"));
    // בין 00:00 ל־05:00 עדיין "יום 5" הנוכחי; יום 4 נסגר.
    expect(after.slice(3, 6)).toEqual(["missed", "today", "locked"]);
    expect(states(at("2026-12-06T05:00:00+02:00")).slice(3, 6)).toEqual(["missed", "yesterday", "today"]);
  });

  it("today counts toward the total once a step is marked, and stays 'today'", () => {
    const m = pathModel(at("2026-12-04T14:00:00+02:00"), s, { 1: 1, 2: 1, 3: 1, 4: 1 });
    expect(m.stones[3].state).toBe("today");
    expect(m.counted).toBe(4);
    expect(m.completed).toBe(false);
  });

  it("live days are flagged (7 and 14) and fill follows steps", () => {
    const m = pathModel(at("2026-12-07T10:00:00+02:00"), s, { 7: 3, 6: 2, 5: 1 });
    expect(m.stones.filter((x) => x.live).map((x) => x.day)).toEqual([7, 14]);
    expect(m.stones[6].fill).toBe(1);
    expect(m.stones[5].fill).toBe(0.75);
    expect(m.stones[4].fill).toBe(0.5);
    expect(m.stones[7].fill).toBe(0);
    expect(fillForSteps(0)).toBe(0);
  });

  it("completed at 12 counted days", () => {
    const steps = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 1]));
    const m = pathModel(at("2026-12-13T10:00:00+02:00"), s, steps);
    expect(m.counted).toBe(12);
    expect(m.completed).toBe(true);
    expect(pathModel(at("2026-12-13T10:00:00+02:00"), s, { ...steps, 12: 0 }).completed).toBe(false);
  });

  it("day 14: locked, then today, then 'yesterday' after the end until midnight, then closed", () => {
    expect(states(at("2026-12-14T04:59:00+02:00"))[13]).toBe("locked");
    expect(states(at("2026-12-14T05:00:00+02:00"))[13]).toBe("today");
    // 2026-12-15 05:00: האתגר הסתיים; יום 14 עוד פתוח לסימון עד חצות.
    const ended = pathModel(at("2026-12-15T10:00:00+02:00"), s, {});
    expect(ended.stones[13].state).toBe("yesterday");
    expect(ended.stones.some((x) => x.state === "today" || x.state === "locked")).toBe(false);
    expect(ended.tomorrow).toBeNull();
    const closed = states(at("2026-12-16T00:00:00+02:00"));
    expect(closed[13]).toBe("missed");
    expect(closed.every((x) => x === "missed")).toBe(true);
  });

  it("tomorrow is the only locked stone with a link", () => {
    const m = pathModel(at("2026-12-04T14:00:00+02:00"), s, {});
    expect(m.tomorrow).toBe(5);
    expect(m.stones.filter((x) => x.state === "locked" && x.href).map((x) => x.day)).toEqual([5]);
    expect(pathModel(at("2026-12-14T10:00:00+02:00"), s, {}).tomorrow).toBeNull();
  });

  it("stoneState exposes the same mapping per day", () => {
    expect(stoneState(9, 0, at("2026-12-04T14:00:00+02:00"), s)).toBe("locked");
    expect(stoneState(3, 0, at("2026-12-04T14:00:00+02:00"), s)).toBe("yesterday");
    expect(stoneState(2, 0, at("2026-12-04T14:00:00+02:00"), s)).toBe("missed");
  });
});

describe("day param", () => {
  it("accepts 1..14 only, without signs, zeros or decimals", () => {
    expect(parseDayParam("1")).toBe(1);
    expect(parseDayParam("14")).toBe(14);
    for (const bad of ["0", "15", "01", "-1", "1.5", "abc", "", "1e1", " 3", "3 ", "٣", "99"]) {
      expect(parseDayParam(bad)).toBeNull();
    }
  });
});

describe("day screen", () => {
  it("before start and no schedule", () => {
    expect(dayScreen(3, at("2026-11-30T12:00:00+02:00"), s, 0)).toEqual({ kind: "locked", reason: "before_start" });
    expect(dayScreen(1, at("2026-12-04T12:00:00+02:00"), null, 0)).toEqual({ kind: "locked", reason: "before_start" });
  });
  it("tomorrow vs far future", () => {
    const now = at("2026-12-04T14:00:00+02:00");
    expect(dayScreen(5, now, s, 0)).toEqual({ kind: "locked", reason: "tomorrow" });
    expect(dayScreen(6, now, s, 0)).toEqual({ kind: "locked", reason: "far" });
    expect(dayScreen(14, now, s, 0)).toEqual({ kind: "locked", reason: "far" });
  });
  it("tomorrow flips to today at 05:00", () => {
    expect(dayScreen(5, at("2026-12-05T04:59:00+02:00"), s, 0)).toEqual({ kind: "locked", reason: "tomorrow" });
    expect(dayScreen(5, at("2026-12-05T05:00:00+02:00"), s, 0)).toEqual({ kind: "today" });
  });
  it("current day, yesterday, older", () => {
    const now = at("2026-12-04T14:00:00+02:00");
    expect(dayScreen(4, now, s, 0)).toEqual({ kind: "today" });
    expect(dayScreen(3, now, s, 0)).toEqual({ kind: "open", markable: true, counted: false });
    expect(dayScreen(3, now, s, 2)).toEqual({ kind: "open", markable: true, counted: true });
    expect(dayScreen(2, now, s, 0)).toEqual({ kind: "open", markable: false, counted: false });
    expect(dayScreen(2, now, s, 1)).toEqual({ kind: "open", markable: false, counted: true });
  });
  it("midnight closes yesterday", () => {
    expect(dayScreen(3, at("2026-12-04T23:59:00+02:00"), s, 0)).toMatchObject({ kind: "open", markable: true });
    expect(dayScreen(3, at("2026-12-05T00:00:00+02:00"), s, 0)).toMatchObject({ kind: "open", markable: false });
  });
  it("after the end: day 14 markable until midnight, then closed; nothing locked", () => {
    expect(dayScreen(14, at("2026-12-15T10:00:00+02:00"), s, 0)).toEqual({ kind: "open", markable: true, counted: false });
    expect(dayScreen(14, at("2026-12-16T00:00:00+02:00"), s, 0)).toEqual({ kind: "open", markable: false, counted: false });
    expect(dayScreen(7, at("2026-12-20T10:00:00+02:00"), s, 0)).toMatchObject({ kind: "open", markable: false });
  });
});
