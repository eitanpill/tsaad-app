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
  "[YESODOT_OFFER_EXPIRY]",
  "[YESODOT_EMAIL_TIMING]",
  "[MEDIA_*]",
  "[UTM_SESSION]",
  "[UTM_YESODOT]",
  "[GHL_FIELD_MAP]",
  "[HOSTING_ENV]",
  "[ACCESSIBILITY_CONTACT]",
]);

// Variables the code fills in at render time.
const ALLOWED_TOKENS = new Set([
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
  "username",
  "link",
  "sessionLink",
  "bundleLink",
  "yesodotLink",
  "hours",
  "deadline",
  "spots",
  "seconds",
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

  it("matches the spec for a few anchor days", () => {
    expect(DAYS[0].habit.title).toBe("מים חמימים עם לימון");
    expect(DAYS[3].habit.title).toBe("שבע דקות אור שמש");
    expect(DAYS[3].movement.title).toBe("פלג גוף תחתון");
    expect(DAYS[3].meditation.title).toBe("שלושה צלילים");
    expect(DAYS[13].habit.title).toBe("בחירת הרגלים להמשך");
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
    for (const s of [activation.whatsapp, activation.emailBody, forgot.whatsapp, forgot.emailBody]) {
      expect(s).not.toMatch(/\{pass|סיסמה זמנית|הסיסמה שלכם:/);
      expect(s).toContain("{link}");
      expect(s).toContain("לא כדאי להעביר אותו");
    }
  });

  it("gives the two show-password buttons different names", () => {
    expect(copy.a11y.forms.showPassword).not.toBe(copy.a11y.forms.showConfirmPassword);
  });

  it("names the reminder switch with its visible row title", () => {
    expect(copy.a11y.reminders.switchName).toBe(copy.reminders.toggleTitle);
  });

  it("has a push text for each live day and a generic one", () => {
    expect(copy.push.generic).toContain("{day}");
    expect(copy.push.liveDay).toContain("{time}");
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
    const section = md.split("## שאלות לפית")[1] ?? "";
    const count = section.split("\n").filter((l) => /^\d+\. /.test(l)).length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(6);
  });
});
