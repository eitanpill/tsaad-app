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
});
