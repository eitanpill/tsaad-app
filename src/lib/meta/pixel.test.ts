import { describe, expect, it } from "vitest";
import { isMetaPixelPath, metaConsentMode, metaPixelId } from "./pixel";

describe("meta pixel config", () => {
  it("accepts only a numeric pixel id", () => {
    expect(metaPixelId("1234567890123456")).toBe("1234567890123456");
    expect(metaPixelId(" 1234567890 ")).toBe("1234567890");
    for (const bad of [undefined, null, "", "abc", "12345", "123456789'); alert(1);//", "1234567 89", "１２３４５６７"]) {
      expect(metaPixelId(bad)).toBeNull();
    }
  });
  it("consent mode is notice unless exactly optin", () => {
    expect(metaConsentMode(undefined)).toBe("notice");
    expect(metaConsentMode("optin")).toBe("optin");
    expect(metaConsentMode("OPTIN")).toBe("notice");
  });
  it("runs on the sales page only", () => {
    expect(isMetaPixelPath("/tsaad")).toBe(true);
    expect(isMetaPixelPath("/tsaad/")).toBe(true);
    for (const p of ["/", "/today", "/login", "/tsaad-x", "/tsaad/x", "/legal/privacy"]) expect(isMetaPixelPath(p)).toBe(false);
  });
});
