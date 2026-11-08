// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createLogger, redact, REDACTED } from "./logger";

function capture() {
  const lines: Record<string, unknown>[] = [];
  const log = createLogger({
    level: "debug",
    now: () => new Date("2026-11-08T00:00:00Z"),
    sink: (l) => lines.push(JSON.parse(l)),
  });
  return { log, lines };
}

describe("redact", () => {
  it("redacts sensitive keys, case-insensitively, at any depth", () => {
    const out = redact({
      userId: "u1",
      Password: "x",
      nested: { sessionToken: "t", list: [{ api_secret: "s", ok: 1 }] },
      headers: { Cookie: "c", Authorization: "Bearer z" },
      contact: { email: "a@b.co", phone: "050", ghlWebhookUrl: "https://hook" },
    }) as {
      userId: string; Password: string;
      nested: { sessionToken: string; list: { api_secret: string; ok: number }[] };
      headers: { Cookie: string; Authorization: string };
      contact: { email: string; phone: string; ghlWebhookUrl: string };
    };
    expect(out.userId).toBe("u1");
    expect(out.Password).toBe(REDACTED);
    expect(out.nested.sessionToken).toBe(REDACTED);
    expect(out.nested.list[0].api_secret).toBe(REDACTED);
    expect(out.nested.list[0].ok).toBe(1);
    expect(out.headers.Cookie).toBe(REDACTED);
    expect(out.headers.Authorization).toBe(REDACTED);
    expect(out.contact.email).toBe(REDACTED);
    expect(out.contact.phone).toBe(REDACTED);
    expect(out.contact.ghlWebhookUrl).toBe(REDACTED);
  });

  it("handles circular refs, dates and bigint", () => {
    const a: Record<string, unknown> = { n: BigInt(1), d: new Date(0) };
    a.self = a;
    const out = redact(a) as Record<string, unknown>;
    expect(out.n).toBe("1");
    expect(out.d).toBe("1970-01-01T00:00:00.000Z");
    expect(out.self).toBe("[Circular]");
  });

  it("does not mutate the input", () => {
    const input = { password: "x" };
    redact(input);
    expect(input.password).toBe("x");
  });
});

describe("logger", () => {
  it("writes one JSON line with time, level, msg and redacted fields", () => {
    const { log, lines } = capture();
    log.info("login", { userId: "u1", password: "hunter2" });
    expect(lines).toEqual([
      { time: "2026-11-08T00:00:00.000Z", level: "info", msg: "login", userId: "u1", password: REDACTED },
    ]);
  });

  it("scrubs URLs and emails from error messages and msg text", () => {
    const { log, lines } = capture();
    log.error("failed https://hook.example/abc to a@b.co", {
      err: new Error("POST https://hook.example/abc?k=1 failed for a@b.co"),
    });
    const raw = JSON.stringify(lines);
    expect(raw).not.toContain("hook.example");
    expect(raw).not.toContain("a@b.co");
  });

  it("respects level and child fields (also redacted)", () => {
    const lines: string[] = [];
    const log = createLogger({ level: "warn", sink: (l) => lines.push(l) });
    log.info("hidden");
    log.child({ requestToken: "abc", reqId: "r1" }).warn("shown");
    expect(lines).toHaveLength(1);
    const rec = JSON.parse(lines[0]);
    expect(rec.reqId).toBe("r1");
    expect(rec.requestToken).toBe(REDACTED);
  });
});
