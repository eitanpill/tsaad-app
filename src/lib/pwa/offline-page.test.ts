import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { copy } from "@/content/copy.he";

const html = readFileSync(path.join(process.cwd(), "public/offline.html"), "utf8");

describe("public/offline.html", () => {
  it("is static: no scripts, no inline styles, no nonce, no inline event handlers, no external hosts", () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<style/i);
    expect(html).not.toMatch(/\sstyle=/i);
    expect(html).not.toMatch(/\son\w+=/i);
    expect(html).not.toMatch(/nonce/i);
    expect(html).not.toMatch(/https?:\/\//i);
  });
  it("carries the same wording as the copy deck, and is Hebrew RTL", () => {
    expect(html).toContain('<html lang="he" dir="rtl">');
    expect(html).toContain(`<h1>${copy.states.offline.heading}</h1>`);
    expect(html).toContain(`<p>${copy.states.offline.body}</p>`);
    expect(html).toContain(`>${copy.common.retry}</a>`);
  });
  it("does not promise that marks are queued (they are not)", () => {
    expect(html).not.toContain("יישמרו");
    expect(copy.states.offline.body).not.toContain("יישמרו");
  });
});
