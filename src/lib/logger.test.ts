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

describe("redaction hardening (security review)", () => {
  it("scrubs PII and secrets inside free-text string values, not only keys", () => {
    const out = JSON.stringify(
      redact({
        note: "contact dana@example.test or +972-50-123-4567 / 050-1234567",
        db: "connect postgres://u:pw@localhost/db failed",
        hdr: "Bearer abc.def-123",
        jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
        list: ["https://hook.example/x?k=1", { inner: "e@x.co" }],
      }),
    );
    for (const s of ["dana@example.test", "123-4567", "1234567", "pw@localhost", "abc.def-123", "eyJhbGci", "hook.example", "e@x.co"]) {
      expect(out).not.toContain(s);
    }
  });

  it("keeps ordinary ids, dates and numbers readable", () => {
    const out = redact({
      reqId: "123e4567-e89b-12d3-a456-426614174000",
      date: "2026-11-08",
      count: 1234567890,
      day: 7,
    });
    expect(out).toEqual({ reqId: "123e4567-e89b-12d3-a456-426614174000", date: "2026-11-08", count: 1234567890, day: 7 });
  });

  it("redacts more sensitive key names (api keys, ip, auth, endpoint, names)", () => {
    const out = redact({
      apiKey: "k", BUNNY_TOKEN_KEY: "k", key: "k", ip: "1.2.3.4", "x-forwarded-for": "1.2.3.4",
      p256dh: "k", auth: "a", endpoint: "https://push", passwordHash: "h", displayName: "דנה",
      databaseUrl: "postgres://x", description: "ok", tip: "ok",
    }) as Record<string, unknown>;
    for (const k of ["apiKey", "BUNNY_TOKEN_KEY", "key", "ip", "x-forwarded-for", "p256dh", "auth", "endpoint", "passwordHash", "displayName", "databaseUrl"]) {
      expect(out[k], k).toBe(REDACTED);
    }
    expect(out.description).toBe("ok");
    expect(out.tip).toBe("ok");
  });

  it("does not copy extra error fields (e.g. pg detail) and follows cause safely", () => {
    const pgErr = Object.assign(new Error("duplicate key"), { detail: "Key (email)=(a@b.co) exists", code: "23505" });
    const top = new Error("insert failed", { cause: pgErr });
    (pgErr as Error & { cause?: unknown }).cause = top; // cycle
    const out = JSON.stringify(redact({ err: top }));
    expect(out).not.toContain("a@b.co");
    expect(out).toContain("duplicate key");
    expect(out).toContain("[Circular]");
  });

  it("handles arrays of errors, Maps, Sets, buffers, functions and deep nesting", () => {
    let deep: Record<string, unknown> = { password: "x" };
    for (let i = 0; i < 20; i++) deep = { d: deep };
    const out = JSON.stringify(
      redact({ errs: [new Error("x a@b.co")], m: new Map([["email", "a@b.co"]]), s: new Set(["a@b.co"]), b: Buffer.from("secret"), f: () => 1, deep }),
    );
    expect(out).not.toContain("a@b.co");
    expect(out).not.toContain("secret");
    expect(out).toContain("[MaxDepth]");
  });

  it("does not let fields override time/level/msg, and never throws", () => {
    const { log, lines } = capture();
    log.info("real", { level: "debug", msg: "fake", time: "1999" });
    expect(lines[0]).toMatchObject({ level: "info", msg: "real", time: "2026-11-08T00:00:00.000Z" });
    const evil = Object.defineProperty({}, "boom", { enumerable: true, get() { throw new Error("getter"); } });
    expect(() => log.warn("x", { evil })).not.toThrow();
    expect(lines[1]).toMatchObject({ level: "warn", logError: true });
  });
});
