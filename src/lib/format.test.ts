import { describe, expect, it } from "vitest";
import { fill } from "./format";

describe("fill", () => {
  it("fills known variables and leaves unknown ones", () => {
    expect(fill("a {x} b {y}", { x: 3 })).toBe("a 3 b {y}");
  });
});
