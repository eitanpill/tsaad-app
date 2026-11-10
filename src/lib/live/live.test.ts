import { describe, expect, it } from "vitest";
import { LIVE } from "@/config/constants";
import { makeSchedule } from "@/lib/days";
import { buildIcs, icsEscape, icsFold, icsUtc } from "./ics";
import { focusSession, liveSession, liveSessions, liveWhen, nextLiveChange } from "./model";

// START 2026-12-01 (Israel winter time, +02:00): day 7 is 2026-12-07, day 14 is 2026-12-14.
const schedule = makeSchedule("2026-12-01");
const at = (iso: string) => new Date(iso);
const IN = { time: "20:00", url: "https://live.example.test/room" };

describe("liveSession window (time known)", () => {
  const t = (iso: string) => liveSession(7, at(iso), schedule, IN);

  it("is before until one hour ahead, and never exposes the URL then", () => {
    const s = t("2026-12-07T18:59:59+02:00");
    expect(s.state).toBe("before");
    expect(s.joinUrl).toBeNull();
    expect(s.opensAt?.toISOString()).toBe(at("2026-12-07T19:00:00+02:00").toISOString());
    expect(s.nextChange?.toISOString()).toBe(s.opensAt?.toISOString());
  });
  it("opens exactly LIVE.linkOpensBeforeMinutes before the start", () => {
    expect(LIVE.linkOpensBeforeMinutes).toBe(60);
    const s = t("2026-12-07T19:00:00+02:00");
    expect(s.state).toBe("open");
    expect(s.joinUrl).toBe(IN.url);
  });
  it("stays open through the session and the grace, then passes (URL gone again)", () => {
    expect(t("2026-12-07T20:00:00+02:00").state).toBe("open");
    const lastOpen = at("2026-12-07T20:00:00+02:00").getTime() + LIVE.linkOpenAfterStartMinutes * 60_000;
    expect(t(new Date(lastOpen - 1).toISOString()).joinUrl).toBe(IN.url);
    const after = t(new Date(lastOpen).toISOString());
    expect(after.state).toBe("passed");
    expect(after.joinUrl).toBeNull();
    expect(after.nextChange).toBeNull();
  });
  it("an open window without a configured URL says so instead of inventing one", () => {
    const s = liveSession(7, at("2026-12-07T19:30:00+02:00"), schedule, { time: "20:00" });
    expect(s).toMatchObject({ state: "open", joinUrl: null, linkMissing: true });
  });
});

describe("liveSession without a time (nothing is invented)", () => {
  it("is before on its own day, with no URL, no calendar, and no window", () => {
    const s = liveSession(7, at("2026-12-07T21:00:00+02:00"), schedule, { url: IN.url });
    expect(s).toMatchObject({ state: "before", time: null, startsAt: null, joinUrl: null, calendarAvailable: false });
  });
  it("passes only once its day is over (the next day opened)", () => {
    expect(liveSession(7, at("2026-12-08T04:59:00+02:00"), schedule, {}).state).toBe("before");
    expect(liveSession(7, at("2026-12-08T05:00:00+02:00"), schedule, {}).state).toBe("passed");
    expect(liveSession(14, at("2026-12-15T05:00:00+02:00"), schedule, {}).state).toBe("passed");
  });
  it("without a schedule everything is before", () => {
    expect(liveSession(7, at("2026-12-07T19:30:00+02:00"), null, IN)).toMatchObject({ state: "before", startsAt: null, joinUrl: null });
  });
  it("next change is the end of its day", () => {
    const s = liveSession(7, at("2026-12-07T09:00:00+02:00"), schedule, {});
    expect(s.nextChange?.toISOString()).toBe(at("2026-12-08T05:00:00+02:00").toISOString());
  });
});

describe("focus and next change", () => {
  const inputs = { 7: IN, 14: { time: "19:30" } };
  it("focuses the first session that has not passed, else the last", () => {
    expect(focusSession(liveSessions(at("2026-12-03T10:00:00+02:00"), schedule, inputs)).day).toBe(7);
    expect(focusSession(liveSessions(at("2026-12-09T10:00:00+02:00"), schedule, inputs)).day).toBe(14);
    expect(focusSession(liveSessions(at("2026-12-20T10:00:00+02:00"), schedule, inputs)).day).toBe(14);
  });
  it("reports the earliest upcoming boundary", () => {
    const s = liveSessions(at("2026-12-07T10:00:00+02:00"), schedule, inputs);
    expect(nextLiveChange(s)?.toISOString()).toBe(at("2026-12-07T19:00:00+02:00").toISOString());
    expect(nextLiveChange(liveSessions(at("2027-02-01T10:00:00+02:00"), schedule, inputs))).toBeNull();
  });
});

describe("liveWhen", () => {
  it("is null without a time, and carries a Hebrew date when the date is known", () => {
    expect(liveWhen(liveSession(7, at("2026-12-01T10:00:00+02:00"), schedule, {}), "Asia/Jerusalem")).toBeNull();
    const w = liveWhen(liveSession(7, at("2026-12-01T10:00:00+02:00"), schedule, IN), "Asia/Jerusalem")!;
    expect(w.time).toBe("20:00");
    expect(w.date).toContain("7");
    expect(w.datetime).toBe("2026-12-07T18:00:00.000Z");
  });
});

describe("time zone: Asia/Jerusalem is DST-aware", () => {
  it("20:00 local is 18:00Z in winter and 17:00Z in summer", () => {
    const winter = liveSession(7, at("2026-12-01T10:00:00+02:00"), schedule, IN);
    expect(winter.startsAt?.toISOString()).toBe("2026-12-07T18:00:00.000Z");
    const summer = liveSession(7, at("2026-06-01T10:00:00+03:00"), makeSchedule("2026-06-01"), IN);
    expect(summer.startsAt?.toISOString()).toBe("2026-06-07T17:00:00.000Z");
  });
  it("the challenge can straddle the autumn change (clocks go back 2026-10-25)", () => {
    const s = makeSchedule("2026-10-20");
    // day 7 = 2026-10-26, after the change (+02:00)
    expect(liveSession(7, at("2026-10-20T10:00:00+03:00"), s, IN).startsAt?.toISOString()).toBe("2026-10-26T18:00:00.000Z");
    // day 14 = 2026-11-02, also after the change
    expect(liveSession(14, at("2026-10-20T10:00:00+03:00"), s, { time: "19:30" }).startsAt?.toISOString()).toBe("2026-11-02T17:30:00.000Z");
  });
});

describe("ics", () => {
  const startsAt = at("2026-12-07T20:00:00+02:00");
  const stamp = at("2026-12-01T09:00:00Z");
  const ics = buildIcs({ uid: "live-day7@example.test", startsAt, summary: "צעד קטן ביום: חצי הדרך, יחד עם אביטל", description: "שורה, עם; תווים\nושורה שנייה", url: "https://app.example.test/live", stamp });
  const unfolded = ics.replace(/\r\n /g, "");

  it("uses CRLF, ends with a newline, and has one event", () => {
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
  it("writes start and end in UTC from Jerusalem local time", () => {
    expect(unfolded).toContain("DTSTART:20261207T180000Z");
    expect(unfolded).toContain(`DTEND:20261207T${String(18 + Math.floor(LIVE.calendarDurationMinutes / 60)).padStart(2, "0")}${String(LIVE.calendarDurationMinutes % 60).padStart(2, "0")}00Z`);
    expect(unfolded).toContain("DTSTAMP:20261201T090000Z");
  });
  it("escapes text and folds lines to 75 octets without cutting a character", () => {
    expect(unfolded).toContain("DESCRIPTION:שורה\\, עם\\; תווים\\nושורה שנייה");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(icsEscape("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
    // CR or LF in any text field never starts a new property line (no header injection).
    expect(icsEscape("x\r\nATTENDEE:evil\ry")).not.toMatch(/[\r\n]/);
    expect(icsFold("x".repeat(200)).split("\r\n ").join("")).toBe("x".repeat(200));
    expect(icsUtc(at("2026-06-07T17:00:00Z"))).toBe("20260607T170000Z");
  });
  it("never carries the live link", () => {
    expect(unfolded).not.toContain(IN.url);
  });
});
