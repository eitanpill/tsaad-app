import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AVITAL_MAX_BYTES, AVITAL_PHOTOS } from "./photos";
import { avitalPhoto } from "@/lib/photos/avital";

const DIR = path.join(process.cwd(), "public", "avital");
const entries = Object.entries(AVITAL_PHOTOS);

describe("Avital photo manifest", () => {
  it("every slot that is on has its file, within the size cap", () => {
    for (const [slot, p] of entries.filter(([, p]) => p.present)) {
      const f = path.join(DIR, p.file);
      expect(existsSync(f), `${slot}: public/avital/${p.file} is missing`).toBe(true);
      expect(statSync(f).size, `${slot}: ${p.file} is over the cap`).toBeLessThanOrEqual(AVITAL_MAX_BYTES);
    }
  });

  it("no real photo sits in public/avital unlisted or switched off (it would be forgotten)", () => {
    const real = readdirSync(DIR).filter((n) => /\.(jpe?g|webp)$/i.test(n));
    for (const n of real) {
      const slot = entries.find(([, p]) => p.file === n);
      expect(slot, `${n} is not in the manifest`).toBeTruthy();
      expect(slot![1].present, `${n} exists but its slot is off: set present: true`).toBe(true);
    }
  });

  it("file names are unique, local, and the alt text is Hebrew", () => {
    expect(new Set(entries.map(([, p]) => p.file)).size).toBe(entries.length);
    for (const [, p] of entries) {
      expect(p.file).toMatch(/^[a-z0-9-]+\.(jpg|webp)$/);
      expect(p.alt).toMatch(/[א-ת]/);
      expect(p.ratio).toBeGreaterThan(0);
    }
  });

  it("slots resolve to null while off, to the manifest file when on", () => {
    for (const [slot, p] of entries) {
      const r = avitalPhoto(slot as keyof typeof AVITAL_PHOTOS, {});
      if (p.present) expect(r?.src).toBe(`/avital/${p.file}`);
      else expect(r).toBeNull();
    }
  });

  it("the e2e fixture switch is ignored on a deployed environment", () => {
    for (const [slot, p] of entries.filter(([, p]) => !p.present)) {
      const env = { TSAAD_E2E_PHOTOS: "1", NODE_ENV: "production", VERCEL: "1" };
      expect(avitalPhoto(slot as keyof typeof AVITAL_PHOTOS, env), p.file).toBeNull();
      const prodNoE2e = { TSAAD_E2E_PHOTOS: "1", NODE_ENV: "production", APP_ORIGIN: "https://example.com" };
      expect(avitalPhoto(slot as keyof typeof AVITAL_PHOTOS, prodNoE2e)).toBeNull();
    }
  });
});
