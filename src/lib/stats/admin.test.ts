import { describe, expect, it } from "vitest";
import { isAdminUsername, parseAdminUsernames } from "./admin";

describe("admin usernames", () => {
  it("parses a comma list, trimmed and case-insensitive", () => {
    expect([...parseAdminUsernames(" Dana , avital,,  ")]).toEqual(["dana", "avital"]);
  });
  it("nobody is admin when the variable is unset or empty", () => {
    expect(isAdminUsername("dana", undefined)).toBe(false);
    expect(isAdminUsername("dana", "")).toBe(false);
    expect(isAdminUsername("dana", " , ")).toBe(false);
  });
  it("matches whole usernames only", () => {
    expect(isAdminUsername("dana", "dana,avital")).toBe(true);
    expect(isAdminUsername("DANA", "dana")).toBe(true);
    expect(isAdminUsername("dan", "dana")).toBe(false);
    expect(isAdminUsername("dana2", "dana")).toBe(false);
    expect(isAdminUsername("", "dana")).toBe(false);
    expect(isAdminUsername(null, "dana")).toBe(false);
  });
});
