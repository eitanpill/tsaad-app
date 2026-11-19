// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildConfig } from "@/config";
import { parseEnv } from "@/config/env";
import { copy } from "@/content/copy.he";
import { DAYS } from "@/content/days";
import { makeSchedule } from "@/lib/days";
import { combineEveningMode, getGhlConfig } from "@/lib/ghl/config";
import { eveningDedupeKey, eveningPayloadSchema, GHL_EVENING_REMINDER_KIND } from "@/lib/ghl/outbox";
import { buildEveningReminderMessage } from "@/lib/push/message";
import { eveningContent } from "./content";
import { eveningDay, eveningDueMinutes, eveningDueNow } from "./timing";

const TOKEN = "pit-0123456789abcdef0123456789abcdef";
const hm = (h: number, m = 0) => h * 60 + m;

describe("eveningContent", () => {
  it("day 0: done variant, tomorrow = day 1", () => {
    expect(eveningContent(0, false)).toEqual({ variant: "done", habit: DAYS[0].habit.title, practice: DAYS[0].movement.title });
    expect(eveningContent(0, true)?.variant).toBe("done");
  });
  it("day 1 and 6: open or done by completion; tomorrow from DAYS[N+1]", () => {
    expect(eveningContent(1, false)).toEqual({ variant: "open", habit: DAYS[1].habit.title, practice: DAYS[1].movement.title });
    expect(eveningContent(1, true)?.variant).toBe("done");
    // day 6: tomorrow is the live day 7: practice is the live copy
    expect(eveningContent(6, false)).toEqual({ variant: "open", habit: DAYS[6].habit.title, practice: copy.evening.liveTomorrowPractice });
    expect(eveningContent(6, true)).toMatchObject({ variant: "done", practice: copy.evening.liveTomorrowPractice });
  });
  it("day 13: tomorrow is live day 14", () => {
    expect(eveningContent(13, false)).toEqual({ variant: "open", habit: DAYS[13].habit.title, practice: copy.evening.liveTomorrowPractice });
  });
  it("day 14: last when not completed (no tomorrow part), nothing when completed", () => {
    expect(eveningContent(14, false)).toEqual({ variant: "last" });
    expect(eveningContent(14, true)).toBeNull();
  });
  it("out of range: null", () => {
    for (const d of [-1, 15, 100, 1.5, Number.NaN]) expect(eveningContent(d, false)).toBeNull();
  });
});

describe("eveningDay", () => {
  const s = makeSchedule("2026-12-01");
  const at = (iso: string) => new Date(iso);
  it("0 the evening before START_DATE, 1..14 on the days, null outside and without a schedule", () => {
    expect(eveningDay(at("2026-11-30T20:30:00+02:00"), s)).toBe(0);
    expect(eveningDay(at("2026-12-01T20:30:00+02:00"), s)).toBe(1);
    expect(eveningDay(at("2026-12-14T20:30:00+02:00"), s)).toBe(14);
    expect(eveningDay(at("2026-11-29T20:30:00+02:00"), s)).toBeNull();
    expect(eveningDay(at("2026-12-15T20:30:00+02:00"), s)).toBeNull();
    expect(eveningDay(at("2026-12-03T20:30:00+02:00"), null)).toBeNull();
  });
});

describe("eveningDueMinutes / eveningDueNow", () => {
  it("is the evening time on a regular day, and when no live time is set", () => {
    expect(eveningDueMinutes({ eveningTime: "20:30", day: 3 })).toBe(hm(20, 30));
    expect(eveningDueMinutes({ eveningTime: "20:30", day: 7 })).toBe(hm(20, 30));
    // a non-live day ignores a live time
    expect(eveningDueMinutes({ eveningTime: "20:30", day: 3, liveTime: "20:00" })).toBe(hm(20, 30));
  });
  it("on a live day (0, 7, 14) inside [start - 60, start + 60) it moves to the live end", () => {
    for (const day of [0, 7, 14]) {
      expect(eveningDueMinutes({ eveningTime: "20:30", day, liveTime: "20:00" })).toBe(hm(21));
      expect(eveningDueMinutes({ eveningTime: "20:30", day, liveTime: "21:00" })).toBe(hm(22)); 
    }
    // boundaries: exactly start-60 is inside, exactly the end is outside
    expect(eveningDueMinutes({ eveningTime: "19:00", day: 7, liveTime: "20:00" })).toBe(hm(21));
    expect(eveningDueMinutes({ eveningTime: "18:59", day: 7, liveTime: "20:00" })).toBe(hm(18, 59));
    expect(eveningDueMinutes({ eveningTime: "21:00", day: 7, liveTime: "20:00" })).toBe(hm(21));
    expect(eveningDueMinutes({ eveningTime: "21:01", day: 7, liveTime: "20:00" })).toBe(hm(21, 1));
  });
  it("a live that ends after the cutoff means nothing is sent that evening", () => {
    const due = eveningDueMinutes({ eveningTime: "22:00", day: 7, liveTime: "22:30" });
    expect(due).toBe(hm(23, 30));
    expect(eveningDueNow(hm(23, 45), due)).toBe(false);
  });
  it("due from the time until (not including) 23:00", () => {
    const due = hm(20, 30);
    expect(eveningDueNow(hm(20, 29), due)).toBe(false);
    expect(eveningDueNow(hm(20, 30), due)).toBe(true);
    expect(eveningDueNow(hm(22, 59), due)).toBe(true);
    expect(eveningDueNow(hm(23), due)).toBe(false);
  });
});

describe("evening payload schema and dedupe key", () => {
  it("accepts {date, day 0..14} and nothing else (strict, no PII)", () => {
    expect(eveningPayloadSchema.safeParse({ date: "2026-12-03", day: 0 }).success).toBe(true);
    expect(eveningPayloadSchema.safeParse({ date: "2026-12-14", day: 14 }).success).toBe(true);
    expect(eveningPayloadSchema.safeParse({ date: "2026-12-03", day: 15 }).success).toBe(false);
    expect(eveningPayloadSchema.safeParse({ date: "2026-12-03", day: -1 }).success).toBe(false);
    expect(eveningPayloadSchema.safeParse({ date: "12/03", day: 3 }).success).toBe(false);
    expect(eveningPayloadSchema.safeParse({ date: "2026-12-03", day: 3, habit: "x" }).success).toBe(false);
  });
  it("dedupe key is kind:user:date", () => {
    expect(GHL_EVENING_REMINDER_KIND).toBe("ghl_evening_reminder");
    expect(eveningDedupeKey("u1", "2026-12-03")).toBe("ghl_evening_reminder:u1:2026-12-03");
  });
});

describe("evening mode combination", () => {
  const cfg = (e: Record<string, string>, raw: Record<string, string | undefined> = {}) => getGhlConfig(parseEnv(e), raw);
  const GHL = { GHL_API_TOKEN: TOKEN, GHL_LOCATION_ID: "loc-123456" };
  it("table: live only if both live; dry if either dry; off if either off", () => {
    const modes = ["off", "dry", "live"] as const;
    const expected = { off: { off: "off", dry: "off", live: "off" }, dry: { off: "off", dry: "dry", live: "dry" }, live: { off: "off", dry: "dry", live: "live" } };
    for (const e of modes) for (const g of modes) expect(combineEveningMode(e, g), `${e}/${g}`).toBe(expected[e][g]);
  });
  it("defaults: evening off, 20:30, documented names", () => {
    const env = parseEnv({});
    expect(env.EVENING_REMINDERS_MODE).toBe("off");
    expect(env.EVENING_REMINDER_TIME).toBe("20:30");
    expect(cfg({})).toMatchObject({
      eveningMode: "off",
      fields: { tomorrowHabit: "tsaad_tomorrow_habit", tomorrowPractice: "tsaad_tomorrow_practice" },
      tags: { eveningOpen: "tsaad_evening_open", eveningDone: "tsaad_evening_done", eveningLast: "tsaad_evening_last" },
    });
  });
  it("from env: live+live is live; live evening with GHL dry is dry; evening dry with GHL live is dry", () => {
    expect(cfg({ EVENING_REMINDERS_MODE: "live", GHL_REMINDER_MODE: "live", ...GHL }).eveningMode).toBe("live");
    expect(cfg({ EVENING_REMINDERS_MODE: "live", GHL_REMINDER_MODE: "dry" }).eveningMode).toBe("dry");
    expect(cfg({ EVENING_REMINDERS_MODE: "dry", GHL_REMINDER_MODE: "live", ...GHL }).eveningMode).toBe("dry");
    expect(cfg({ EVENING_REMINDERS_MODE: "live", GHL_REMINDER_MODE: "off" }).eveningMode).toBe("off");
  });
  it("never live in test envs or without a token (GHL live refused becomes off)", () => {
    expect(cfg({ EVENING_REMINDERS_MODE: "live", GHL_REMINDER_MODE: "live", ...GHL }, { NODE_ENV: "test" }).eveningMode).toBe("off");
    expect(cfg({ EVENING_REMINDERS_MODE: "live", GHL_REMINDER_MODE: "live" }).eveningMode).toBe("off");
  });
  it("rejects a bad mode or time", () => {
    expect(() => parseEnv({ EVENING_REMINDERS_MODE: "on" })).toThrow();
    expect(() => parseEnv({ EVENING_REMINDER_TIME: "8pm" })).toThrow();
    expect(buildConfig({ EVENING_REMINDER_TIME: "21:15" }).env.EVENING_REMINDER_TIME).toBe("21:15");
  });
});

describe("buildEveningReminderMessage", () => {
  it("open / done / last texts, title, url and tag", () => {
    const habit = DAYS[3].habit.title;
    expect(buildEveningReminderMessage({ variant: "open", habit, practice: "x" }, 3)).toEqual({
      title: "ערב טוב \u{1F319}",
      body: `אם עוד לא יצא לכם לתרגל היום, יש עוד זמן. מחר בבוקר: ${habit}.`,
      url: "/today",
      tag: "evening-3",
    });
    expect(buildEveningReminderMessage({ variant: "done", habit, practice: "x" }, 3).body).toBe(`מחר בבוקר מחכה לכם: ${habit}. לילה טוב.`);
    expect(buildEveningReminderMessage({ variant: "last" }, 14)).toMatchObject({
      body: "היום האחרון של האתגר עוד כאן, ויש עוד זמן לצעד קטן. לילה טוב.",
      tag: "evening-14",
    });
  });
});
