import { describe, expect, it } from "vitest";
import { detectPlatform } from "./platform";

const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const CHROME_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0 Mobile/15E148 Safari/604.1";
const INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36";
const WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36";

describe("detectPlatform", () => {
  it("iPhone Safari", () => expect(detectPlatform(SAFARI)).toBe("ios-safari"));
  it("iPhone Chrome and in-app browsers", () => {
    expect(detectPlatform(CHROME_IOS)).toBe("ios-other");
    expect(detectPlatform(INSTAGRAM)).toBe("ios-other");
  });
  it("iPad that reports itself as a Mac", () => {
    expect(detectPlatform(IPAD, 5)).toBe("ios-safari");
    expect(detectPlatform(IPAD, 0)).toBe("desktop");
  });
  it("Android and desktop", () => {
    expect(detectPlatform(ANDROID)).toBe("android");
    expect(detectPlatform(WIN)).toBe("desktop");
  });
});
