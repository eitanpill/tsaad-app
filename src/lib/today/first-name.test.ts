import { describe, expect, it } from "vitest";
import { firstNameOf } from "./first-name";

describe("firstNameOf", () => {
  it("takes the first word of a clean display name", () => {
    expect(firstNameOf("דנה כהן", "dana-1")).toBe("דנה");
    expect(firstNameOf("  מיכל  ", "michal")).toBe("מיכל");
    expect(firstNameOf("Dana Cohen", "dcohen")).toBe("Dana");
  });
  it("returns null when the display name is just the username fallback", () => {
    expect(firstNameOf("dana5", "dana5")).toBeNull();
    expect(firstNameOf("Dana5", "dana5")).toBeNull();
  });
  it("returns null for empty, too short, too long or unclean values", () => {
    expect(firstNameOf("", "u")).toBeNull();
    expect(firstNameOf(null, "u")).toBeNull();
    expect(firstNameOf("א", "u")).toBeNull();
    expect(firstNameOf("אבגדהוזחטיכלמנסעפצקרשתאבגדהו", "u")).toBeNull();
    expect(firstNameOf("evil.com", "u")).toBeNull();
    expect(firstNameOf("050123", "u")).toBeNull();
  });

  it("rejects bidi and invisible control characters, URLs, emoji and names that start with a mark or a dash", () => {
    expect(firstNameOf("\u202Eדנה", "u")).toBeNull();
    expect(firstNameOf("דנה\u200F", "u")).toBeNull();
    expect(firstNameOf("ד\u200Bנה", "u")).toBeNull();
    expect(firstNameOf("https://evil.example", "u")).toBeNull();
    expect(firstNameOf("www.evil.co", "u")).toBeNull();
    expect(firstNameOf("😀😀", "u")).toBeNull();
    expect(firstNameOf("דנה😀", "u")).toBeNull();
    expect(firstNameOf("-דנה", "u")).toBeNull();
    expect(firstNameOf("\u05B0\u05B0", "u")).toBeNull();
    expect(firstNameOf("<b>", "u")).toBeNull();
  });
  it("keeps names with an apostrophe or a maqaf", () => {
    expect(firstNameOf("ג'ני כהן", "u")).toBe("ג'ני");
    expect(firstNameOf("אנה־מריה", "u")).toBe("אנה־מריה");
  });
});
