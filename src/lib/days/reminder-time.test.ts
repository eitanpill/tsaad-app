// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatMinutes, isReminderMinutes, reminderChoices, reminderCutoffMinutes, reminderDueForUser } from ".";

const at = (s: string) => new Date(s);
const TZ = "Asia/Jerusalem";
const due = (iso: string, reminderMinutes: number, handled = false) =>
  reminderDueForUser({ now: at(iso), timeZone: TZ, reminderMinutes, handled });

describe("the choices", () => {
  it("are 32 times, every 30 minutes, from 05:30 to 21:00", () => {
    const c = reminderChoices();
    expect(c).toHaveLength(32);
    expect(formatMinutes(c[0])).toBe("05:30");
    expect(formatMinutes(c[1])).toBe("06:00");
    expect(formatMinutes(c.at(-1)!)).toBe("21:00");
    for (let i = 1; i < c.length; i++) expect(c[i] - c[i - 1]).toBe(30);
    expect(c).toContain(450); // the 07:30 default
  });
  it("isReminderMinutes accepts exactly those", () => {
    for (const m of reminderChoices()) expect(isReminderMinutes(m)).toBe(true);
    for (const m of [0, 300, 329, 331, 345, 360.5, 1261, 1290, 1440, -30, NaN, Infinity, "450", null, undefined]) {
      expect(isReminderMinutes(m), String(m)).toBe(false);
    }
  });
  it("formatMinutes pads", () => {
    expect(formatMinutes(330)).toBe("05:30");
    expect(formatMinutes(1259 + 1)).toBe("21:00");
    expect(formatMinutes(0)).toBe("00:00");
  });
});

describe("cut-off = chosen time + 4.5h, capped at 23:59", () => {
  it("07:30 -> 12:00 (the old fixed rule, for the default)", () => {
    expect(formatMinutes(reminderCutoffMinutes(450))).toBe("12:00");
  });
  it("05:30 -> 10:00, 09:00 -> 13:30, 16:00 -> 20:30", () => {
    expect(formatMinutes(reminderCutoffMinutes(330))).toBe("10:00");
    expect(formatMinutes(reminderCutoffMinutes(540))).toBe("13:30");
    expect(formatMinutes(reminderCutoffMinutes(960))).toBe("20:30");
  });
  it("is capped at 23:59 from 19:30 up (19:30 + 4.5h is exactly 24:00); 18:30 -> 23:00", () => {
    expect(reminderCutoffMinutes(1110)).toBe(1380); // 18:30 + 4.5h = 23:00
    expect(reminderCutoffMinutes(1140)).toBe(1410); // 19:00 -> 23:30
    expect(reminderCutoffMinutes(1170)).toBe(1439); // 19:30 -> 24:00, capped
    expect(reminderCutoffMinutes(1260)).toBe(1439); // 21:00
    for (const m of reminderChoices()) expect(reminderCutoffMinutes(m)).toBeLessThanOrEqual(1439);
  });
});

describe("due-time boundaries (winter, UTC+2)", () => {
  it("07:30: not at 07:29:59, due at 07:30:00 and at any later run, until 11:59:59", () => {
    expect(due("2026-12-02T05:29:59Z", 450)).toEqual({ due: false, reason: "too_early" });
    expect(due("2026-12-02T05:30:00Z", 450)).toEqual({ due: true, date: "2026-12-02" });
    expect(due("2026-12-02T05:45:00Z", 450)).toEqual({ due: true, date: "2026-12-02" });
    expect(due("2026-12-02T09:59:59Z", 450)).toEqual({ due: true, date: "2026-12-02" });
    expect(due("2026-12-02T10:00:00Z", 450)).toEqual({ due: false, reason: "past_cutoff" });
  });
  it("every choice: the first minute is due, one second earlier is too early, the cut-off minute is past", () => {
    for (const m of reminderChoices()) {
      const startUtc = Date.UTC(2026, 11, 2, 0, 0, 0) + (m - 120) * 60_000; // local = UTC+2
      expect(reminderDueForUser({ now: new Date(startUtc - 1000), timeZone: TZ, reminderMinutes: m, handled: false }), `${m} early`).toEqual({ due: false, reason: "too_early" });
      expect(reminderDueForUser({ now: new Date(startUtc), timeZone: TZ, reminderMinutes: m, handled: false }), `${m} start`).toEqual({ due: true, date: "2026-12-02" });
      const cutoffUtc = Date.UTC(2026, 11, 2, 0, 0, 0) + (reminderCutoffMinutes(m) - 120) * 60_000;
      expect(reminderDueForUser({ now: new Date(cutoffUtc - 1000), timeZone: TZ, reminderMinutes: m, handled: false }).due, `${m} before cutoff`).toBe(true);
      expect(reminderDueForUser({ now: new Date(cutoffUtc), timeZone: TZ, reminderMinutes: m, handled: false }), `${m} cutoff`).toEqual({ due: false, reason: "past_cutoff" });
    }
  });
  it("21:00 runs until 23:58:59 and not at 23:59, and 00:00 next day is a different date (too early)", () => {
    expect(due("2026-12-02T21:58:59Z", 1260)).toEqual({ due: true, date: "2026-12-02" });
    expect(due("2026-12-02T21:59:00Z", 1260)).toEqual({ due: false, reason: "past_cutoff" });
    expect(due("2026-12-02T22:00:00Z", 1260)).toEqual({ due: false, reason: "too_early" }); // 00:00 on Dec 3
  });
  it("a cron run every 15 minutes always catches each choice inside its window", () => {
    for (const m of reminderChoices()) {
      let hit = 0;
      for (let t = 0; t < 1440; t += 15) {
        const now = new Date(Date.UTC(2026, 11, 2, 0, 0, 0) + (t - 120) * 60_000);
        if (reminderDueForUser({ now, timeZone: TZ, reminderMinutes: m, handled: false }).due) hit++;
      }
      expect(hit, `choice ${m}`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("already handled today", () => {
  it("is not due again on the same local date, whatever the time", () => {
    expect(due("2026-12-02T06:00:00Z", 450, true)).toEqual({ due: false, reason: "already_handled" });
    expect(due("2026-12-02T09:00:00Z", 450, true)).toEqual({ due: false, reason: "already_handled" });
  });
  it("a user who changed their time after today's reminder went out: no second send, for any new time", () => {
    // the reminder_log row for the date exists (handled), so a new, later time or earlier time inside its window is still not due
    for (const newTime of reminderChoices()) {
      for (const iso of ["2026-12-02T05:30:00Z", "2026-12-02T07:00:00Z", "2026-12-02T12:00:00Z"]) {
        expect(reminderDueForUser({ now: at(iso), timeZone: TZ, reminderMinutes: newTime, handled: true }).due).toBe(false);
      }
    }
  });
  it("the next date is due again", () => {
    expect(due("2026-12-03T07:00:00Z", 540, false)).toEqual({ due: true, date: "2026-12-03" }); // 09:00 on Dec 3
  });
  it("changing to a time that has not come yet, before anything was sent, holds the reminder until then", () => {
    expect(due("2026-12-02T05:30:00Z", 600, false)).toEqual({ due: false, reason: "too_early" }); // moved to 10:00
    expect(due("2026-12-02T08:00:00Z", 600, false)).toEqual({ due: true, date: "2026-12-02" });
  });
});

describe("Asia/Jerusalem daylight saving", () => {
  // Spring forward: Friday 2027-03-26 02:00 -> 03:00 (UTC+2 -> UTC+3). Before the change a local time is UTC-2h, after it UTC-3h.
  it("spring forward: 05:30 is 03:30Z the day before and 02:30Z on the change day", () => {
    expect(due("2027-03-25T03:29:59Z", 330).due).toBe(false);
    expect(due("2027-03-25T03:30:00Z", 330)).toEqual({ due: true, date: "2027-03-25" });
    expect(due("2027-03-26T02:29:59Z", 330)).toEqual({ due: false, reason: "too_early" });
    expect(due("2027-03-26T02:30:00Z", 330)).toEqual({ due: true, date: "2027-03-26" });
  });
  it("spring forward: 21:00 and the 23:59 cap follow local time on the change day", () => {
    expect(due("2027-03-26T17:59:59Z", 1260).due).toBe(false); // 20:59:59 local (UTC+3)
    expect(due("2027-03-26T18:00:00Z", 1260).due).toBe(true); // 21:00
    expect(due("2027-03-26T20:58:59Z", 1260).due).toBe(true); // 23:58:59
    expect(due("2027-03-26T20:59:00Z", 1260)).toEqual({ due: false, reason: "past_cutoff" }); // 23:59
  });
  // Fall back: Sunday 2026-10-25 02:00 -> 01:00 (UTC+3 -> UTC+2). The change is before 05:30, so every choice is unambiguous.
  it("fall back: 05:30 is 02:30Z the day before and 03:30Z on the change day", () => {
    expect(due("2026-10-24T02:29:59Z", 330).due).toBe(false);
    expect(due("2026-10-24T02:30:00Z", 330)).toEqual({ due: true, date: "2026-10-24" });
    expect(due("2026-10-25T03:29:59Z", 330)).toEqual({ due: false, reason: "too_early" });
    expect(due("2026-10-25T03:30:00Z", 330)).toEqual({ due: true, date: "2026-10-25" });
  });
  it("fall back: 07:30 on the change day is 05:30Z (04:30Z is only 06:30 local)", () => {
    expect(due("2026-10-25T04:30:00Z", 450)).toEqual({ due: false, reason: "too_early" });
    expect(due("2026-10-25T05:30:00Z", 450)).toEqual({ due: true, date: "2026-10-25" });
    expect(due("2026-10-25T09:59:59Z", 450).due).toBe(true); // 11:59:59
    expect(due("2026-10-25T10:00:00Z", 450).due).toBe(false); // 12:00
  });
  it("the whole 32 choices on both change days: due exactly from their own local minute", () => {
    for (const [dateIso, offsetHours] of [["2027-03-26", 3], ["2026-10-25", 2]] as const) {
      const [y, mo, dd] = dateIso.split("-").map(Number);
      for (const m of reminderChoices()) {
        const startUtc = Date.UTC(y, mo - 1, dd, 0, 0, 0) + (m - offsetHours * 60) * 60_000;
        expect(reminderDueForUser({ now: new Date(startUtc - 1000), timeZone: TZ, reminderMinutes: m, handled: false }).due, `${dateIso} ${m} -1s`).toBe(false);
        expect(reminderDueForUser({ now: new Date(startUtc), timeZone: TZ, reminderMinutes: m, handled: false }).due, `${dateIso} ${m}`).toBe(true);
      }
    }
  });
});
