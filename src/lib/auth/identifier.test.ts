import { describe, expect, it } from "vitest";
import { classifyIdentifier } from "./identifier";

describe("classifyIdentifier", () => {
  it("emails are lowercased and trimmed", () => {
    expect(classifyIdentifier("  Dana@Example.COM ")).toEqual({ kind: "email", normalized: "dana@example.com" });
  });
  it.each(["0521234567", "052-123-4567", "+972521234567", "972521234567", "00972521234567", "(052) 123 4567"])(
    "Israeli phone %s normalizes to E.164",
    (input) => {
      expect(classifyIdentifier(input)).toMatchObject({ kind: "phone", normalized: "+972521234567" });
    },
  );
  it("everything else is a lowercase username", () => {
    expect(classifyIdentifier(" Dana.L ")).toEqual({ kind: "username", normalized: "dana.l" });
    expect(classifyIdentifier("yogi12345")).toEqual({ kind: "username", normalized: "yogi12345" });
  });
  it("a malformed email stays a username (and matches nothing)", () => {
    expect(classifyIdentifier("not@@mail")).toEqual({ kind: "username", normalized: "not@@mail" });
  });
  it("letters mixed with digits are not a phone", () => {
    expect(classifyIdentifier("ext0521234567")).toMatchObject({ kind: "username" });
  });
});
