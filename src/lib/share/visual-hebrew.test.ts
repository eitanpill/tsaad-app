import { describe, expect, it } from "vitest";
import { copy } from "@/content/copy.he";
import { visualHebrew } from "./visual-hebrew";

describe("visualHebrew (satori draws each word left to right)", () => {
  it("reverses the letters of Hebrew words and keeps the word order", () => {
    expect(visualHebrew("צעד קטן ביום")).toBe("דעצ ןטק םויב");
  });
  it("keeps numbers and Latin as they are, also next to Hebrew in one word", () => {
    expect(visualHebrew("14 ימים")).toBe("14 םימי");
    expect(visualHebrew("ה־14")).toBe("14־ה");
    expect(visualHebrew("ב־3.5")).toBe("3.5־ב");
    expect(visualHebrew("YOGIT")).toBe("YOGIT");
    expect(visualHebrew("מ־YOGIT")).toBe("YOGIT־מ");
  });
  it("moves punctuation to the visual left of a Hebrew word and mirrors brackets", () => {
    expect(visualHebrew("ביום.")).toBe(".םויב");
    expect(visualHebrew("(יום)")).toBe("(םוי)");
  });
  it("the card copy has no run of several Latin words (which would flip order)", () => {
    for (const t of [copy.finish.shareText, copy.brand.name, copy.brand.byline]) {
      expect(/[A-Za-z]+ [A-Za-z]+/.test(t), t).toBe(false);
    }
  });
});
