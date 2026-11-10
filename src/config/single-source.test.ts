// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * מקור הגדרות אחד: קריאה ישירה ל־process.env מותרת רק ב־src/config, ובמקומות שאינם יכולים לייבא אותו
 * (קוד לקוח, proxy ב־edge, instrumentation שבודק את הסביבה בעלייה, הלוגר).
 */
const ALLOWED = new Set([
  "src/app/(app)/_components/PwaBoot.tsx",
  "src/instrumentation.ts",
  "src/proxy.ts",
  "src/lib/logger.ts",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("single config source", () => {
  it("reads process.env directly only in src/config and the allow-listed files", () => {
    const root = process.cwd();
    const offenders = walk(join(root, "src"))
      .map((p) => relative(root, p))
      .filter((p) => !p.startsWith("src/config/") && !ALLOWED.has(p))
      .filter((p) => readFileSync(join(root, p), "utf8").includes("process.env"));
    expect(offenders).toEqual([]);
  });
});
