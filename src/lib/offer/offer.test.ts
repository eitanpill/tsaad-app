// @vitest-environment node
import { describe, expect, it } from "vitest";
import { makeSchedule } from "@/lib/days";
import { formatDeadline, liveEndsAt, offerState, offerWindow, yesodotValidity } from "./model";
import { offerLink, safeHttpsUrl } from "./links";

// START_DATE 2026-12-01 (winter, +02:00): day 14 is 2026-12-14, live at 20:00 = 18:00Z; ends 60 min later (19:00Z).
const schedule = makeSchedule("2026-12-01");
const inputs = { liveTime: "20:00", windowHours: 48 };
const at = (s: string) => new Date(s);

describe("offerState (server clock)", () => {
  it("is not yet before the day-14 live ends, with the opening time as the next change", () => {
    const s = offerState(at("2026-12-14T20:30:00+02:00"), schedule, inputs);
    expect(s).toMatchObject({ state: "notYet" });
    expect(s.nextChange?.toISOString()).toBe("2026-12-14T19:00:00.000Z");
    expect(offerState(at("2026-12-01T10:00:00+02:00"), schedule, inputs).state).toBe("notYet");
  });
  it("opens exactly when the live ends and closes OFFER_WINDOW_HOURS later (no countdown, only a deadline)", () => {
    const open = offerState(at("2026-12-14T21:00:00+02:00"), schedule, inputs);
    expect(open.state).toBe("open");
    if (open.state !== "open") throw new Error();
    expect(open.opensAt.toISOString()).toBe("2026-12-14T19:00:00.000Z");
    expect(open.deadline.toISOString()).toBe("2026-12-16T19:00:00.000Z");
    expect(open.hours).toBe(48);
    expect(offerState(new Date("2026-12-14T18:59:59.999Z"), schedule, inputs).state).toBe("notYet");
    expect(offerState(new Date("2026-12-14T19:00:00.000Z"), schedule, inputs).state).toBe("open");
    expect(offerState(new Date("2026-12-16T18:59:59.999Z"), schedule, inputs).state).toBe("open");
    expect(offerState(new Date("2026-12-16T19:00:00.000Z"), schedule, inputs).state).toBe("expired");
    expect(offerState(at("2027-01-30T10:00:00+02:00"), schedule, inputs)).toMatchObject({ state: "expired" });
  });
  it("never invents a window: missing live time, window hours or start date keeps it closed", () => {
    const now = at("2026-12-20T10:00:00+02:00");
    expect(offerState(now, schedule, { liveTime: undefined, windowHours: 48 }).state).toBe("notYet");
    expect(offerState(now, schedule, { liveTime: "20:00", windowHours: undefined }).state).toBe("notYet");
    expect(offerState(now, null, inputs).state).toBe("notYet");
    expect(offerState(now, schedule, { liveTime: "20:00", windowHours: 0 }).state).toBe("notYet");
    expect(liveEndsAt(null, "20:00")).toBeNull();
  });
  it("follows summer time (DST) because the live time is local", () => {
    const summer = makeSchedule("2026-07-01");
    expect(liveEndsAt(summer, "20:00")?.toISOString()).toBe("2026-07-14T18:00:00.000Z"); // +03:00
  });
  it("formats the deadline in Israel time", () => {
    expect(formatDeadline(new Date("2026-12-16T19:00:00Z"), "Asia/Jerusalem")).toMatch(/21:00/);
  });
});

describe("Yesodot validity (same window as the day-14 offers)", () => {
  const deadline = "2026-12-16T19:00:00.000Z"; // live end 19:00Z on 2026-12-14 + 48h
  it("offerWindow is the single source for the window", () => {
    expect(offerWindow(schedule, inputs)?.deadline.toISOString()).toBe(deadline);
    expect(offerWindow(null, inputs)).toBeNull();
    expect(offerWindow(schedule, { liveTime: undefined, windowHours: 48 })).toBeNull();
    expect(offerWindow(schedule, { liveTime: "20:00", windowHours: undefined })).toBeNull();
  });
  it("before day 14 it is valid until the window end (page stays open, deadline shown)", () => {
    const v = yesodotValidity(at("2026-12-05T10:00:00+02:00"), schedule, inputs);
    expect(v.kind).toBe("valid");
    expect(v.kind === "valid" && v.until.toISOString()).toBe(deadline);
    expect(yesodotValidity(at("2026-12-14T20:30:00+02:00"), schedule, inputs).kind).toBe("valid"); // live still running
  });
  it("inside the window it is valid and matches the offer deadline", () => {
    const now = at("2026-12-15T12:00:00+02:00");
    const v = yesodotValidity(now, schedule, inputs);
    const o = offerState(now, schedule, inputs);
    expect(v.kind).toBe("valid");
    expect(o.state === "open" && v.kind === "valid" && o.deadline.getTime() === v.until.getTime()).toBe(true);
    expect(yesodotValidity(new Date("2026-12-16T18:59:59.999Z"), schedule, inputs).kind).toBe("valid");
    expect(formatDeadline(v.kind === "valid" ? v.until : now, "Asia/Jerusalem")).toMatch(/21:00/);
  });
  it("after the window it is expired", () => {
    expect(yesodotValidity(new Date(deadline), schedule, inputs).kind).toBe("expired");
    expect(yesodotValidity(at("2027-01-30T10:00:00+02:00"), schedule, inputs)).toMatchObject({ kind: "expired" });
  });
  it("is unset (expiryTba) when the window cannot be computed", () => {
    const now = at("2026-12-20T10:00:00+02:00");
    expect(yesodotValidity(now, schedule, { liveTime: undefined, windowHours: 48 })).toEqual({ kind: "unset" });
    expect(yesodotValidity(now, null, inputs)).toEqual({ kind: "unset" });
    expect(yesodotValidity(now, schedule, { liveTime: "20:00", windowHours: undefined })).toEqual({ kind: "unset" });
  });
});

describe("offer links", () => {
  it("only https URLs count; placeholders and junk are no link", () => {
    expect(safeHttpsUrl("[MORNING_URL_SESSION_271]")).toBeNull();
    expect(safeHttpsUrl("http://pay.example.test/x")).toBeNull();
    expect(safeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpsUrl(undefined)).toBeNull();
    expect(offerLink("[MORNING_URL_SESSION_271]", "x")).toBeNull();
  });
  it("adds UTM source, medium and campaign; keeps existing query and existing utm values", () => {
    const u = new URL(offerLink("https://pay.example.test/p?ref=1", "session271")!);
    expect(u.searchParams.get("ref")).toBe("1");
    expect(u.searchParams.get("utm_source")).toBe("tsaad_app");
    expect(u.searchParams.get("utm_medium")).toBe("app");
    expect(u.searchParams.get("utm_campaign")).toBe("session271");
    const keep = new URL(offerLink("https://pay.example.test/p?utm_source=wa", undefined)!);
    expect(keep.searchParams.get("utm_source")).toBe("wa");
    expect(keep.searchParams.has("utm_campaign")).toBe(false);
  });
});
