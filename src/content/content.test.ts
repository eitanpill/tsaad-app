import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { copy } from "./copy.he";
import { ACTION_TYPES, DAYS } from "./days";

const FORBIDDEN = [
  "בונוס",
  "מבצע מוגבל",
  "נשארו רק",
  "מרפא",
  "ירפא",
  "מבטיח",
  "Bunny",
  "GHL",
  "שרת",
  "טוקן",
];

// Placeholders that appear in the original spec, plus the accessibility contact named in the brief.
const ALLOWED_PLACEHOLDERS = new Set([
  "[MORNING_URL_CHALLENGE_79]",
  "[MORNING_URL_SESSION_271]",
  "[MORNING_URL_YESODOT_1265]",
  "[START_DATE]",
  "[LIVE_DAY7_TIME]",
  "[LIVE_DAY14_TIME]",
  "[ZOOM_LINK]",
  "[YESODOT_EMAIL_TIMING]",
  "[MEDIA_*]",
  "[MORNING_URL_BUNDLE_139]",
  "[UTM_SESSION]",
  "[UTM_BUNDLE]",
  "[UTM_YESODOT]",
  "[GHL_FIELD_MAP]",
  "[HOSTING_ENV]",
  "[ACCESSIBILITY_CONTACT]",
]);

// Variables the code fills in at render time.
const ALLOWED_TOKENS = new Set([
  "done",
  "page",
  "pages",
  "until",
  "total",
  "unlockTime",
  "reminderTime",
  "liveTime",
  "n",
  "prev",
  "day",
  "habit",
  "type",
  "title",
  "state",
  "counted",
  "remaining",
  "time",
  "text",
  "name",
  "greeting",
  "username",
  "link",
  "sessionLink",
  "bundleLink",
  "yesodotLink",
  "hours",
  "deadline",
  "spots",
  "seconds",
  "date",
]);

// Forms that read as one gender only, or that put pressure on the reader.
const GENDERED_OR_PUSHY = [
  "סיימת",
  "פספסת",
  "סימנת",
  "התחלת",
  "רשומה",
  "לחצו כאן",
  "אל תפספסו",
  "מהרו",
];

function collect(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collect(v, out));
  else if (value && typeof value === "object") {
    Object.values(value).forEach((v) => collect(v, out));
  }
  return out;
}

const copyStrings = collect(copy);
const dayStrings = DAYS.flatMap((d) => [
  d.habit.title,
  d.movement.title,
  d.meditation.title,
  d.opening,
  ...[d.habit, d.movement, d.meditation].flatMap((a) => (a.detail ? [a.detail] : [])),
]);
const allStrings = [...copyStrings, ...dayStrings];

describe("days", () => {
  it("has exactly 14 days, numbered 1 to 14, with 3 actions each", () => {
    expect(DAYS).toHaveLength(14);
    DAYS.forEach((d, i) => {
      expect(d.day).toBe(i + 1);
      const actions = [d.habit, d.movement, d.meditation];
      expect(actions.map((a) => a.type)).toEqual([...ACTION_TYPES]);
      actions.forEach((a) => expect(a.title.trim().length).toBeGreaterThan(0));
    });
  });

  it("marks days 7 and 14 as live, with the title לייב for movement and meditation", () => {
    const live = DAYS.filter((d) => d.live).map((d) => d.day);
    expect(live).toEqual([7, 14]);
    for (const d of DAYS.filter((x) => x.live)) {
      expect(d.movement.title).toBe("לייב");
      expect(d.meditation.title).toBe("לייב");
    }
    for (const d of DAYS.filter((x) => !x.live)) {
      expect(d.movement.title).not.toBe("לייב");
    }
  });

  it("matches Pit's content file for a few anchor days", () => {
    expect(DAYS[0].habit.title).toBe("כוס מים חמימים עם לימון כשקמים");
    expect(DAYS[0].movement.title).toBe("מתיחת בוקר עדינה בעמידה");
    expect(DAYS[3].habit.title).toBe("7 דקות אמבטיית שמש");
    expect(DAYS[3].movement.title).toBe("חיזוק פלג גוף תחתון");
    expect(DAYS[3].meditation.title).toBe("להקשיב ל־3 צלילים סביבכם");
    expect(DAYS[11].habit.title).toBe("חצי שעה בלי מסכים לפני השינה");
    expect(DAYS[13].habit.title).toBe("לבחור את ההרגלים שממשיכים איתם");
  });

  it("keeps the approved short title on day 13 meditation, with Pit's long wording as detail", () => {
    expect(DAYS[12].meditation.title).toBe("7 דקות מודרכות: לבחור הרגלים מיטיבים");
    expect(DAYS[12].meditation.detail).toBe(
      "7 דקות מודרכות על הרגלים: מה עומד מאחוריהם ולמה חשוב לבחור בהרגלים מיטיבים",
    );
    const withDetail = DAYS.flatMap((d) => [d.habit, d.movement, d.meditation]).filter((a) => a.detail);
    expect(withDetail).toHaveLength(1);
  });

  it("has a filmed opening line per day that names the day and the habit", () => {
    for (const d of DAYS) {
      expect(d.opening.startsWith(`יום ${d.day}. ההרגל של היום: `), d.opening).toBe(true);
      expect(d.opening.endsWith("קחו נשימה אחת איתי, ומתחילים."), d.opening).toBe(true);
      expect(d.opening.includes('"'), d.opening).toBe(false);
      expect(d.opening).toBe(`יום ${d.day}. ההרגל של היום: ${d.habit.title}. קחו נשימה אחת איתי, ומתחילים.`);
    }
    expect(DAYS[11].opening).toBe(
      "יום 12. ההרגל של היום: חצי שעה בלי מסכים לפני השינה. קחו נשימה אחת איתי, ומתחילים.",
    );
  });

  it("adds no sugar habit", () => {
    expect(dayStrings.some((s) => /סוכר|מתוק/.test(s))).toBe(false);
  });
});

describe("copy", () => {
  it("has strings", () => {
    expect(copyStrings.length).toBeGreaterThan(200);
  });

  it("has no empty strings", () => {
    copyStrings.forEach((s) => expect(s.trim().length).toBeGreaterThan(0));
  });

  it("contains no forbidden words", () => {
    for (const s of allStrings) {
      for (const word of FORBIDDEN) {
        expect(s.includes(word), `"${word}" in: ${s}`).toBe(false);
      }
    }
  });

  it("avoids gender-marked or pushy phrases", () => {
    for (const s of allStrings) {
      for (const word of GENDERED_OR_PUSHY) {
        expect(s.includes(word), `"${word}" in: ${s}`).toBe(false);
      }
    }
  });

  it("uses only placeholders from the spec", () => {
    for (const s of allStrings) {
      for (const token of s.match(/\[[A-Z0-9_*]+\]/g) ?? []) {
        expect(ALLOWED_PLACEHOLDERS.has(token), `${token} in: ${s}`).toBe(true);
      }
    }
  });

  it("uses only known {variables}", () => {
    for (const s of allStrings) {
      for (const m of s.matchAll(/\{([^}]*)\}/g)) {
        expect(ALLOWED_TOKENS.has(m[1]), `{${m[1]}} in: ${s}`).toBe(true);
      }
    }
  });

  it("has no em-dash, emoji or middle dot in UI copy", () => {
    for (const s of allStrings) {
      expect(s.includes("—"), s).toBe(false);
      expect(s.includes("·"), s).toBe(false);
      expect(/\p{Extended_Pictographic}/u.test(s), s).toBe(false);
    }
  });

  it("has no countdown or stock language", () => {
    for (const s of allStrings) {
      expect(/ספירה לאחור|נותרו|אחרונים|רק עוד/.test(s), s).toBe(false);
    }
  });

  it("states the decided prices exactly", () => {
    expect(copy.offer.day14.session.price).toBe("271 ₪");
    expect(copy.offer.day14.bundle.price).toBe("139 ₪");
    expect(copy.offer.yesodot.price).toBe("1,265 ₪");
    const day14Text = collect(copy.offer.day14).join(" ");
    expect(day14Text.includes("1,265")).toBe(false);
    expect(collect(copy.landing).join(" ")).toContain("79 ₪");
  });

  it("marks the message templates as drafts", () => {
    expect(copy.messages.status).toBe("draft, not sent");
  });

  it("keeps the forgot-password confirmation neutral", () => {
    const text = collect(copy.forgot.confirmation).join(" ");
    expect(text).toContain("אם");
    expect(text).not.toMatch(/לא נמצא|אין חשבון|לא קיים/);
  });

  it("keeps passwords out of account messages and warns not to share the link", () => {
    const { activation, forgot } = copy.messages;
    // links go by email only: there is no WhatsApp activation or reset draft (Meta does not approve a password link)
    expect(activation).not.toHaveProperty("whatsapp");
    expect(forgot).not.toHaveProperty("whatsapp");
    for (const s of [activation.emailBody, forgot.emailBody]) {
      expect(s).not.toMatch(/\{pass|סיסמה זמנית|הסיסמה שלכם:/);
      expect(s).toContain("{link}");
      expect(s).toContain("לא כדאי להעביר אותו");
    }
  });

  it("says the activation and reset link comes by email, never by WhatsApp, and promises no timing", () => {
    const text = [
      copy.forgot.confirmation.body,
      copy.forgot.forgotUsername.body,
      copy.activate.expired.body,
      copy.login.firstTime.body,
      copy.landing.how.access,
    ].join(" ");
    expect(text).not.toMatch(/וואטסאפ|ווטסאפ|WhatsApp/);
    expect(text).toContain("למייל");
    expect(text).not.toMatch(/תוך כמה|בדרך כלל מגיע|מיד|דקות/);
  });

  it("gives the two show-password buttons different names", () => {
    expect(copy.a11y.forms.showPassword).not.toBe(copy.a11y.forms.showConfirmPassword);
  });

  it("names the reminder switch with its visible row title", () => {
    expect(copy.a11y.reminders.switchName).toBe(copy.reminders.toggleTitle);
  });

  it("has a generic daily push text, and a separate live-reminder text", () => {
    expect(copy.push.generic).toContain("{day}");
    expect(copy.push.perDay).toContain("{habit}");
    expect(copy.push.liveTitle).toContain("שעה");
    expect(copy.push.liveBody).not.toMatch(/\{/);
  });

  it("keeps live mentions out of the daily reminder texts (they live only in the separate live reminder)", () => {
    for (const t of [copy.push.title, copy.push.generic, copy.push.perDay]) {
      expect(t).not.toMatch(/לייב|מפגש|חי\b/);
    }
    expect(copy.reminders.liveNote).toMatch(/שעה/);
    expect(copy.reminders.liveNote).toMatch(/רבים|תגיע|כשעה/);
  });
});

describe("copy deck", () => {
  it("mirrors every string in docs/content/COPY.md", () => {
    const md = readFileSync(
      path.join(process.cwd(), "docs/content/COPY.md"),
      "utf8",
    );
    const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
    for (const s of copyStrings) {
      expect(md.includes(esc(s)), `missing in COPY.md: ${s}`).toBe(true);
    }
  });

  it("lists at most 6 questions for Pit", () => {
    const md = readFileSync(
      path.join(process.cwd(), "docs/content/COPY.md"),
      "utf8",
    );
    const section = md.split("## שאלות פתוחות לאישור")[1] ?? "";
    const count = section.split("\n").filter((l) => /^\d+\. /.test(l)).length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(6);
  });
});

describe("times in copy come from config", () => {
  it("no hard-coded HH:MM in the copy or the legal texts (use {unlockTime} / {reminderTime})", async () => {
    const { legal } = await import("./legal.he");
    const hits = (JSON.stringify(copy) + JSON.stringify(legal)).match(/\b\d{1,2}:\d{2}\b/g);
    expect(hits).toBeNull();
  });
});

describe("day video ids", () => {
  it("a videoId, when set, is a plain Bunny id (letters, digits, _ and -)", () => {
    for (const d of DAYS) if (d.videoId !== undefined) expect(d.videoId, `day ${d.day}`).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("D4: one practice video per day; no action carries its own video", () => {
    for (const d of DAYS) {
      for (const a of [d.habit, d.movement, d.meditation]) expect(Object.keys(a)).not.toContain("videoId");
      expect(typeof d.videoId === "string" || d.videoId === undefined).toBe(true);
    }
  });
});
