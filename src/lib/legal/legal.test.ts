// @vitest-environment node
import { describe, expect, it } from "vitest";
import { LEGAL } from "@/config/constants";
import { legal, type LegalBlock } from "@/content/legal.he";
import { fillTokens, formatLegalDate, parseContact, splitContacts } from "./render";

const strings = (b: LegalBlock) => (typeof b === "string" ? [b] : [...b.list]);
const all = Object.values(legal).flatMap((d) => [d.title, d.lead, d.metaDescription, ...d.sections.flatMap((s) => [s.heading, ...s.body.flatMap(strings)])]);

describe("legal content", () => {
  it("has unique section ids per document, with the prefix of its document", () => {
    for (const [key, d] of Object.entries(legal)) {
      const ids = d.sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      ids.forEach((id) => expect(id.startsWith(key[0] + "-")).toBe(true));
    }
  });
  it("uses only the known contact placeholders and tokens, and no other bracket placeholders", () => {
    const text = all.join("\n");
    const brackets = new Set(text.match(/\[[A-Z_]+\]/g) ?? []);
    expect([...brackets].sort()).toEqual(["[ACCESSIBILITY_CONTACT]", "[PRIVACY_CONTACT]", "[SUPPORT_CONTACT]"]);
    const tokens = new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
    expect([...tokens].sort()).toEqual(
      ["accessibilityDate", "reminderLogDays", "sessionAbsoluteDays", "sessionIdleDays", "syncDeadDays", "syncSentDays", "unlockTime", "webhookEventsDays"],
    );
  });
  it("makes no health or outcome claims", () => {
    for (const w of ["מרפא", "ירפא", "מבטיח", "מבטיחה", "תרופה", "לרפא", "מחלה"]) {
      expect(all.join("\n")).not.toContain(w);
    }
  });
  it("states the facts the code guarantees: one cookie, no analytics, Frankfurt, the safety disclaimer, 79 and Israeli law", () => {
    const p = legal.privacy.sections.flatMap((s) => s.body.flatMap(strings)).join("\n");
    expect(p).toContain("עוגייה אחת בלבד");
    expect(p).toContain("aws-eu-central-1");
    expect(p).toContain("פרנקפורט");
    for (const v of ["Vercel", "Neon", "Bunny", "GoHighLevel"]) expect(p).toContain(v);
    const t = legal.terms.sections.flatMap((s) => s.body.flatMap(strings)).join("\n");
    expect(t).toContain("79 ₪");
    expect(t).toContain("דיני מדינת ישראל");
    expect(t).toContain("רופא");
    expect(legal.accessibility.sections.flatMap((s) => s.body.flatMap(strings)).join("\n")).toContain("כתוביות בעברית");
  });
});

describe("legal render helpers", () => {
  it("splits contact placeholders out of text", () => {
    expect(splitContacts("א [PRIVACY_CONTACT] ב")).toEqual([{ text: "א " }, { contact: "PRIVACY_CONTACT" }, { text: " ב" }]);
    expect(splitContacts("בלי")).toEqual([{ text: "בלי" }]);
  });
  it("fills tokens and leaves unknown ones visible", () => {
    expect(fillTokens("{a} ו־{b}", { a: 3 })).toBe("3 ו־{b}");
  });
  it("links only emails and phone numbers; anything else is plain text", () => {
    expect(parseContact(undefined)).toBeNull();
    expect(parseContact("a@b.co")).toMatchObject({ kind: "email", href: "mailto:a@b.co" });
    expect(parseContact("050-123 4567")).toMatchObject({ kind: "tel", href: "tel:0501234567" });
    expect(parseContact("javascript:alert(1)")).toEqual({ kind: "text", value: "javascript:alert(1)" });
  });
  it("formats the review date", () => {
    expect(formatLegalDate(LEGAL.accessibilityLastChecked)).toBe("10 בנובמבר 2026");
  });
});
