// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: h.warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { buildCsp } from "@/lib/security/csp";
import { createReportBudget, parseCspReports, reduceBlocked, reducePage } from "@/lib/security/csp-report";
import { POST } from "./route";

const post = (body: string, type = "application/csp-report") =>
  POST(new Request("http://localhost/api/csp-report", { method: "POST", headers: { "content-type": type }, body }));

const legacy = {
  "csp-report": {
    "document-uri": "https://app.example/activate?token=SECRET-TOKEN-123",
    "effective-directive": "script-src-elem",
    "blocked-uri": "https://evil.example/x.js?leak=abc",
    "source-file": "https://app.example/_next/static/chunks/a.js?v=1",
    "line-number": 12,
    "script-sample": "alert(document.cookie)",
    disposition: "enforce",
  },
};

describe("CSP reporting", () => {
  it("the page CSP points report-uri and report-to at the endpoint", () => {
    const csp = buildCsp("n", { dev: false });
    expect(csp).toContain("report-uri /api/csp-report");
    expect(csp).toContain("report-to csp");
  });

  it("parses both formats and keeps only reduced fields (no query, no token, no script sample)", () => {
    const [a] = parseCspReports(legacy);
    expect(a).toEqual({
      directive: "script-src-elem",
      blocked: "evil.example",
      page: "/activate",
      source: "app.example/_next/static/chunks/a.js",
      line: 12,
      disposition: "enforce",
    });
    expect(JSON.stringify(a)).not.toContain("SECRET");
    expect(JSON.stringify(a)).not.toContain("cookie");
    const b = parseCspReports([
      { type: "csp-violation", url: "https://app.example/today?x=1", body: { effectiveDirective: "frame-src", blockedURL: "https://other.example/embed/1", documentURL: "https://app.example/today?x=1" } },
      { type: "deprecation", body: {} },
    ]);
    expect(b).toEqual([{ directive: "frame-src", blocked: "other.example", page: "/today", source: null, line: null, disposition: null }]);
    expect(parseCspReports({ nope: 1 })).toEqual([]);
    expect(parseCspReports("x")).toEqual([]);
    expect(reduceBlocked("inline")).toBe("inline");
    expect(reduceBlocked("javascript:alert(1)")).toBe("javascript");
    expect(reducePage("not a url")).toBe("other");
  });

  it("answers 204 and logs reduced fields; rejects other types (415) and large bodies (413)", async () => {
    h.warn.mockClear();
    const res = await post(JSON.stringify(legacy));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(h.warn).toHaveBeenCalledTimes(1);
    const fields = JSON.stringify(h.warn.mock.calls[0][1]);
    expect(fields).not.toContain("SECRET");
    expect(fields).not.toContain("leak");
    expect((await post("{}", "text/plain")).status).toBe(415);
    expect((await post("x".repeat(9000))).status).toBe(413);
    expect((await post("not json")).status).toBe(204);
  });

  it("the per-instance budget caps logging per minute and reports how many were dropped", () => {
    let t = 0;
    const b = createReportBudget(2, () => t);
    expect(b.take().allowed).toBe(true);
    expect(b.take().allowed).toBe(true);
    expect(b.take().allowed).toBe(false);
    expect(b.take().allowed).toBe(false);
    t = 61_000;
    expect(b.take()).toEqual({ allowed: true, droppedBefore: 2 });
  });
});
