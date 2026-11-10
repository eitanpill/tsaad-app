import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("web app manifest", () => {
  const m = manifest();
  it("is Hebrew RTL, standalone, and starts at the Today screen", () => {
    expect(m).toMatchObject({ name: "צעד קטן ביום", lang: "he", dir: "rtl", start_url: "/today", display: "standalone", scope: "/" });
    expect(m.short_name).toBeTruthy();
  });
  it("uses brand colours from the tokens", () => {
    const css = readFileSync(path.join(import.meta.dirname, "globals.css"), "utf8");
    expect(css).toContain(`--cream: ${m.background_color}`);
    expect(css).toContain(`--forest: ${m.theme_color}`);
  });
  it("lists 192 and 512 icons plus a maskable one, all present as PNG in public/", () => {
    const icons = m.icons ?? [];
    expect(icons.some((i) => i.sizes === "192x192" && i.purpose === "any")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && i.purpose === "any")).toBe(true);
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
    for (const i of icons) {
      const file = path.join(process.cwd(), "public", i.src);
      expect(existsSync(file), i.src).toBe(true);
      const head = readFileSync(file).subarray(0, 8);
      expect([...head]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const [w, h] = (i.sizes ?? "").split("x").map(Number);
      const buf = readFileSync(file);
      expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([w, h]);
    }
    expect(existsSync(path.join(process.cwd(), "public/apple-touch-icon.png"))).toBe(true);
  });
});
