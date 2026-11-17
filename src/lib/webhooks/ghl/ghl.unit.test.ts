// @vitest-environment node
import { describe, expect, it } from "vitest";
import { cleanName, normalizeEmail, normalizePhoneIL } from "./normalize";
import { parseSignupPayload } from "./payload";
import { isReservedUsername, sanitizeLocalPart, usernameBase, usernameCandidate, usernameRandomCandidate } from "./username";
import {
  WEBHOOK_SECRET_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
  signWebhook,
  verifyWebhookAuth,
} from "./auth";
import { composeSignupMessages, createDryRunDelivery, hasUnresolvedPlaceholder } from "./delivery";
import { deriveEventId } from "./handler";
import { createLogger } from "@/lib/logger";

describe("normalizePhoneIL", () => {
  it.each([
    ["0521234567", "+972521234567"],
    ["052-123-4567", "+972521234567"],
    ["(052) 123 4567", "+972521234567"],
    ["052.123.4567", "+972521234567"],
    ["972521234567", "+972521234567"],
    ["+972521234567", "+972521234567"],
    ["+972 52-123-4567", "+972521234567"],
    ["+972 (0)52-123-4567", "+972521234567"],
    ["00972521234567", "+972521234567"],
    ["521234567", "+972521234567"],
    ["  0521234567  ", "+972521234567"],
    ["03-1234567", "+97231234567"],
    ["+97231234567", "+97231234567"],
    ["0721234567", "+972721234567"],
    ["+14155550123", "+14155550123"],
    ["0044 20 7946 0958", "+442079460958"],
  ])("%s -> %s", (input, out) => expect(normalizePhoneIL(input)).toBe(out));

  it.each([
    "", "   ", "abc", "052-123", "05212345678", "0121234567", "+972", "+9725212345", "052 123 4567 ext 5",
    "0000000000", "+0123456789", "1234", "+1234567", "+1234567890123456", null, undefined, 521234567, {},
  ])("rejects %j", (input) => expect(normalizePhoneIL(input as never)).toBeNull());
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => expect(normalizeEmail("  Dana.Levi@Example.COM ")).toBe("dana.levi@example.com"));
  it("accepts plus tags", () => expect(normalizeEmail("a+b@x.co")).toBe("a+b@x.co"));
  it.each(["", "x", "a@b", "a@@b.co", "a b@c.co", "@c.co", "a@c..co", `${"a".repeat(65)}@c.co`, null, 5])(
    "rejects %j",
    (v) => expect(normalizeEmail(v as never)).toBeNull(),
  );
});

describe("cleanName", () => {
  it("collapses whitespace, strips braces and control characters, caps length", () => {
    expect(cleanName("  דנה \n  לוי ")).toBe("דנה לוי");
    expect(cleanName("Dana {link} <b>x</b>")).toBe("Dana link b x b");
  });
  it("keeps real names: Hebrew with niqqud, apostrophes, hyphens, maqaf, gershayim", () => {
    expect(cleanName("שִׁירָה")).toBe("שִׁירָה");
    expect(cleanName("O'Brien-Smith")).toBe("O'Brien-Smith");
    expect(cleanName("בת־אל")).toBe("בת־אל");
    expect(cleanName("ד\"ר נועה")).toBe("ד\"ר נועה");
    expect(cleanName("José Muñoz")).toBe("José Muñoz");
  });
  it("strips bidi controls, zero-width characters and isolates (RTL spoofing)", () => {
    for (const c of ["\u200e", "\u200f", "\u202a", "\u202b", "\u202c", "\u202d", "\u202e", "\u2066", "\u2067", "\u2068", "\u2069", "\u061c", "\u200b", "\ufeff", "\u2060", "\u00ad"]) {
      expect(cleanName(`דנה${c}לוי`)).toBe("דנה לוי");
    }
    expect(cleanName("\u202egnp.exe")).toBe("gnp exe");
  });
  it("removes URLs, phone numbers, placeholders and emoji (the name is quoted in messages sent in the programme's name)", () => {
    expect(cleanName("Dana https://evil.example/x")).toBe("Dana https evil example x");
    expect(cleanName("call 052-1234567")).toBe("call");
    expect(cleanName("[START_DATE] Dana")).toBe("START DATE Dana");
    expect(cleanName("Dana 🧘‍♀️")).toBe("Dana");
    expect(cleanName("12345")).toBeNull();
    expect(cleanName("--")).toBeNull();
    expect(cleanName("a\u0301\u0301\u0301\u0301\u0301\u0301b")).toBe("\u00e1\u0301\u0301\u0301b");
    expect(cleanName("x".repeat(200))?.length).toBe(80);
    expect(cleanName("   ")).toBeNull();
    expect(cleanName(5 as never)).toBeNull();
  });
});

describe("parseSignupPayload", () => {
  const base = { contact_id: "abc123", first_name: "Dana", last_name: "Levi", email: "Dana@Example.com", phone: "052-123-4567" };
  it("accepts GHL standard fields and normalises", () => {
    const r = parseSignupPayload({ ...base, full_name: "Dana Levi" });
    expect(r).toEqual({
      ok: true,
      data: { ghlContactId: "abc123", displayName: "Dana Levi", email: "dana@example.com", phoneE164: "+972521234567", marker: null },
    });
  });
  it("accepts alternative names (id, firstName, lastName) and builds the display name", () => {
    const r = parseSignupPayload({ id: "z9", firstName: "דנה", lastName: "לוי", email: "d@x.co" });
    expect(r).toMatchObject({ ok: true, data: { ghlContactId: "z9", displayName: "דנה לוי", phoneE164: null } });
  });
  it("treats empty strings and null as missing; phone only is enough", () => {
    const r = parseSignupPayload({ contact_id: "c1", email: "", phone: "0521234567", first_name: null });
    expect(r).toMatchObject({ ok: true, data: { email: null, phoneE164: "+972521234567", displayName: null } });
  });
  it("drops an invalid phone or email as long as one is valid", () => {
    expect(parseSignupPayload({ contact_id: "c", email: "nope", phone: "0521234567" })).toMatchObject({ ok: true, data: { email: null } });
    expect(parseSignupPayload({ contact_id: "c", email: "a@b.co", phone: "123" })).toMatchObject({ ok: true, data: { phoneE164: null } });
  });
  it("rejects: no contact id, bad contact id, no usable contact details, non-objects", () => {
    expect(parseSignupPayload({ email: "a@b.co" })).toEqual({ ok: false, reason: "missing_contact_id" });
    expect(parseSignupPayload({ contact_id: "a b/c", email: "a@b.co" })).toEqual({ ok: false, reason: "invalid_contact_id" });
    expect(parseSignupPayload({ contact_id: "c", email: "bad", phone: "bad" })).toEqual({ ok: false, reason: "missing_contact_details" });
    expect(parseSignupPayload({ contact_id: "c" })).toEqual({ ok: false, reason: "missing_contact_details" });
    for (const v of [null, [], "x", 5]) expect(parseSignupPayload(v)).toEqual({ ok: false, reason: "not_object" });
  });
  it("ignores unknown fields and reads a marker from event_id / signup_id / customData", () => {
    expect(parseSignupPayload({ ...base, extra: { a: 1 }, event_id: "e1" })).toMatchObject({ data: { marker: "e1" } });
    expect(parseSignupPayload({ ...base, customData: { signup_id: "s-2", other: [] } })).toMatchObject({ data: { marker: "s-2" } });
    expect(parseSignupPayload({ ...base, event_id: "bad id!" })).toMatchObject({ data: { marker: null } });
  });
  it("numbers are accepted as ids", () => {
    expect(parseSignupPayload({ contact_id: 12345, email: "a@b.co" })).toMatchObject({ data: { ghlContactId: "12345" } });
  });
});

describe("username rule", () => {
  it("uses the lowercased, ASCII-sanitised email local part", () => {
    expect(usernameBase({ email: "Dana.Levi@example.com" })).toBe("dana.levi");
    expect(usernameBase({ email: "José_Muñoz@x.co" })).toBe("jose_munoz");
    expect(usernameBase({ email: "a+tag@x.co" })).toBe("atag");
    expect(usernameBase({ email: "a+@x.co", phoneE164: null }, () => 0)).toBe("yogi00000");
    expect(usernameBase({ email: "dana+yoga@x.co" })).toBe("danayoga");
    expect(usernameBase({ email: "__dana..levi--@x.co" })).toBe("dana.levi");
    expect(usernameBase({ email: "x".repeat(40) + "@x.co" })).toBe("x".repeat(20));
  });
  it("falls back to national phone digits when the local part is too short or not ASCII", () => {
    expect(usernameBase({ email: "ab@x.co", phoneE164: "+972521234567" })).toBe("0521234567");
    expect(usernameBase({ email: "דנה@x.co", phoneE164: "+972521234567" })).toBe("0521234567");
    expect(usernameBase({ email: null, phoneE164: "+972521234567" })).toBe("0521234567");
    expect(usernameBase({ email: null, phoneE164: "+14155550123" })).toBe("14155550123");
  });
  it("last resort is yogi + 5 digits", () => {
    expect(usernameBase({ email: "ab@x.co" }, () => 0.5)).toBe("yogi50000");
  });
  it("collisions get a numeric suffix and never exceed the maximum length", () => {
    expect(usernameCandidate("dana", 1)).toBe("dana");
    expect(usernameCandidate("dana", 2)).toBe("dana2");
    expect(usernameCandidate("dana", 12)).toBe("dana12");
    const long = "x".repeat(20);
    expect(usernameCandidate(long, 2)).toBe("x".repeat(19) + "2");
    expect(usernameCandidate(long, 105)).toBe("x".repeat(17) + "105");
    expect(usernameCandidate("dana.", 3)).toBe("dana3");
    expect(sanitizeLocalPart("A.B")).toBe("a.b");
  });
  it("always produces lowercase (the DB check requires it)", () => {
    expect(usernameBase({ email: "DANA@x.co" })).toBe("dana");
  });
});

describe("verifyWebhookAuth", () => {
  const secret = "s".repeat(40);
  const now = new Date("2026-12-01T10:00:00Z");
  const nowSec = String(Math.floor(now.getTime() / 1000));
  const H = (h: Record<string, string>) => new Headers(h);
  const body = '{"contact_id":"c1","email":"a@b.co"}';
  const run = (h: Record<string, string>, s: string | undefined | null = secret, b = body) =>
    verifyWebhookAuth({ headers: H(h), rawBody: b, secret: s ?? undefined, now });

  it("fails closed when the secret is unset or shorter than 32", () => {
    expect(run({ [WEBHOOK_SECRET_HEADER]: secret }, null)).toEqual({ ok: false, reason: "not_configured" });
    expect(run({ [WEBHOOK_SECRET_HEADER]: "short" }, "short")).toEqual({ ok: false, reason: "not_configured" });
    expect(run({ [WEBHOOK_SECRET_HEADER]: "" }, "")).toEqual({ ok: false, reason: "not_configured" });
    expect(run({ [WEBHOOK_SECRET_HEADER]: "s".repeat(31) }, "s".repeat(31))).toMatchObject({ ok: false });
  });
  it("accepts the static header on its own", () => {
    expect(run({ [WEBHOOK_SECRET_HEADER]: secret })).toEqual({ ok: true, via: "secret" });
  });
  it("rejects missing, wrong, near-miss and different-length secrets", () => {
    expect(run({})).toEqual({ ok: false, reason: "no_credentials" });
    expect(run({ [WEBHOOK_SECRET_HEADER]: "x".repeat(40) })).toEqual({ ok: false, reason: "bad_secret" });
    expect(run({ [WEBHOOK_SECRET_HEADER]: secret.slice(0, -1) + "t" })).toEqual({ ok: false, reason: "bad_secret" });
    expect(run({ [WEBHOOK_SECRET_HEADER]: secret + "s" })).toEqual({ ok: false, reason: "bad_secret" });
    expect(run({ [WEBHOOK_SECRET_HEADER]: "" })).toEqual({ ok: false, reason: "bad_secret" });
  });
  it("accepts a valid HMAC signature over `timestamp.body` without the static header", () => {
    const sig = signWebhook(secret, nowSec, body);
    expect(run({ [WEBHOOK_TIMESTAMP_HEADER]: nowSec, [WEBHOOK_SIGNATURE_HEADER]: sig })).toEqual({ ok: true, via: "signature" });
    expect(run({ [WEBHOOK_TIMESTAMP_HEADER]: nowSec, [WEBHOOK_SIGNATURE_HEADER]: `sha256=${sig.toUpperCase()}` })).toMatchObject({ ok: true });
  });
  it("rejects a signature over a different body, timestamp or secret", () => {
    const sig = signWebhook(secret, nowSec, body);
    expect(run({ [WEBHOOK_TIMESTAMP_HEADER]: nowSec, [WEBHOOK_SIGNATURE_HEADER]: sig }, secret, body + " ")).toEqual({ ok: false, reason: "bad_signature" });
    expect(run({ [WEBHOOK_TIMESTAMP_HEADER]: String(Number(nowSec) + 1), [WEBHOOK_SIGNATURE_HEADER]: sig })).toEqual({ ok: false, reason: "bad_signature" });
    expect(run({ [WEBHOOK_TIMESTAMP_HEADER]: nowSec, [WEBHOOK_SIGNATURE_HEADER]: signWebhook("o".repeat(40), nowSec, body) })).toEqual({ ok: false, reason: "bad_signature" });
  });
  it("a signature without a timestamp is rejected", () => {
    expect(run({ [WEBHOOK_SIGNATURE_HEADER]: signWebhook(secret, nowSec, body) })).toEqual({ ok: false, reason: "bad_timestamp" });
  });
  it("enforces the 5 minute window both ways, for the static header too, once a timestamp is present", () => {
    const tol = WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS;
    expect(tol).toBe(300);
    const at = (d: number) => ({ [WEBHOOK_SECRET_HEADER]: secret, [WEBHOOK_TIMESTAMP_HEADER]: String(Number(nowSec) + d) });
    expect(run(at(0))).toMatchObject({ ok: true });
    expect(run(at(-tol))).toMatchObject({ ok: true });
    expect(run(at(tol))).toMatchObject({ ok: true });
    expect(run(at(-tol - 1))).toEqual({ ok: false, reason: "stale_timestamp" });
    expect(run(at(tol + 1))).toEqual({ ok: false, reason: "stale_timestamp" });
    // millisecond timestamps are understood
    expect(run({ [WEBHOOK_SECRET_HEADER]: secret, [WEBHOOK_TIMESTAMP_HEADER]: String(now.getTime()) })).toMatchObject({ ok: true });
    for (const bad of ["abc", "-5", "1.5", "", "0x10", "12345678901234567"]) {
      expect(run({ [WEBHOOK_SECRET_HEADER]: secret, [WEBHOOK_TIMESTAMP_HEADER]: bad })).toEqual({ ok: false, reason: "bad_timestamp" });
    }
  });
  it("a stale but correctly signed request is rejected (replay after the dedupe window)", () => {
    const old = String(Number(nowSec) - 3600);
    expect(run({ [WEBHOOK_TIMESTAMP_HEADER]: old, [WEBHOOK_SIGNATURE_HEADER]: signWebhook(secret, old, body) })).toEqual({ ok: false, reason: "stale_timestamp" });
  });
  it("every presented credential must be valid: wrong static header fails even with a good signature", () => {
    const sig = signWebhook(secret, nowSec, body);
    expect(run({ [WEBHOOK_SECRET_HEADER]: "x".repeat(40), [WEBHOOK_TIMESTAMP_HEADER]: nowSec, [WEBHOOK_SIGNATURE_HEADER]: sig })).toMatchObject({ ok: false });
    expect(run({ [WEBHOOK_SECRET_HEADER]: secret, [WEBHOOK_TIMESTAMP_HEADER]: nowSec, [WEBHOOK_SIGNATURE_HEADER]: "00" })).toMatchObject({ ok: false });
  });
  it("compares through constant-time primitives (source check)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");
    expect(src).toContain("constantTimeEqual");
    expect(src).not.toMatch(/[^!]==\s*secret\b/);
  });
});

describe("signature over raw bytes", () => {
  const secret = "s".repeat(40);
  it("string and its UTF-8 bytes give the same signature; a BOM or other byte change does not", () => {
    const body = '{"full_name":"דנה"}';
    const bytes = new TextEncoder().encode(body);
    expect(signWebhook(secret, "1", bytes)).toBe(signWebhook(secret, "1", body));
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]);
    expect(signWebhook(secret, "1", withBom)).not.toBe(signWebhook(secret, "1", body));
    const now = new Date(1000 * 1000);
    const headers = new Headers({ "x-tsaad-timestamp": "1000", "x-tsaad-signature": signWebhook(secret, "1000", withBom) });
    expect(verifyWebhookAuth({ headers, rawBody: withBom, secret, now })).toEqual({ ok: true, via: "signature" });
    expect(verifyWebhookAuth({ headers, rawBody: body, secret, now })).toEqual({ ok: false, reason: "bad_signature" });
  });
});

describe("reserved usernames and random fallback", () => {
  it("staff-like local parts are never used; the rule falls through to phone digits, then yogi", () => {
    for (const e of ["admin@x.co", "Admin.Tsaad@x.co", "support-team@x.co", "tsaad@x.co", "root@x.co", "no-reply@x.co", "system1@x.co"]) {
      expect(isReservedUsername(sanitizeLocalPart(e.split("@")[0]))).toBe(true);
      expect(usernameBase({ email: e, phoneE164: "+972521234567" })).toBe("0521234567");
      expect(usernameBase({ email: e }, () => 0.1)).toBe("yogi10000");
    }
    for (const ok of ["dana", "rootie", "information", "teamar", "adi"]) expect(isReservedUsername(ok)).toBe(false);
  });
  it("random candidate keeps the length limit", () => {
    expect(usernameRandomCandidate("dana", () => 0.123456)).toBe("dana123456");
    expect(usernameRandomCandidate("x".repeat(20), () => 0)).toBe("x".repeat(14) + "000000");
  });
});

describe("deriveEventId", () => {
  it("uses the header when present, validated", () => {
    const e = deriveEventId("evt_1", "c1", null)!;
    expect(e).toMatch(/^ghl:evt:[0-9a-f]{40}$/);
    expect(e).toBe(deriveEventId("evt_1", "c1", "ignored-when-header"));
    expect(deriveEventId("bad id", "c1", null)).toBeNull();
    expect(deriveEventId("", "c1", null)).toBeNull();
    expect(deriveEventId("x".repeat(129), "c1", null)).toBeNull();
  });
  it("derives deterministically from contact id and marker, without exposing either", () => {
    const a = deriveEventId(null, "c1", null)!;
    expect(a).toBe(deriveEventId(null, "c1", null));
    expect(a).not.toBe(deriveEventId(null, "c2", null));
    expect(a).not.toBe(deriveEventId(null, "c1", "m1"));
    expect(a).not.toContain("c1");
  });
  it("a header id is scoped to the contact: a constant header (misconfigured GHL) never blocks another contact", () => {
    expect(deriveEventId("wf-1", "c1", null)).not.toBe(deriveEventId("wf-1", "c2", null));
    expect(deriveEventId("wf-1", "c1", null)).not.toBe(deriveEventId("wf-2", "c1", null));
    expect(deriveEventId("wf-1", "c1", null)).not.toBe(deriveEventId(null, "c1", "wf-1"));
  });
});

describe("composeSignupMessages and the dry-run delivery", () => {
  const link = "https://app.example.test/activate?token=SECRETTOKENVALUE";
  const args = { name: "דנה", username: "dana", link, userId: "u1", hasEmail: true, hasPhone: true, startDate: "2026-12-01" };
  it("fills name, username and link from copy.messages.activation, for the channels that exist", () => {
    const m = composeSignupMessages(args);
    expect(m.map((x) => x.channel)).toEqual(["email"]);
    for (const x of m) {
      expect(x.body).toContain("דנה");
      expect(x.body).toContain("dana");
      expect(x.body).toContain(link);
      expect(hasUnresolvedPlaceholder(x.body)).toBe(false);
    }
    expect(m[0].subject).toBeTruthy();
    expect(composeSignupMessages({ ...args, hasPhone: false }).map((x) => x.channel)).toEqual(["email"]);
    // links go by email only (Meta does not approve a WhatsApp template with a password link): a phone alone gets no message
    expect(composeSignupMessages({ ...args, hasEmail: false })).toEqual([]);
  });
  it("flags an unresolved [START_DATE] when no start date is configured", () => {
    const m = composeSignupMessages({ ...args, startDate: undefined });
    expect(m.every((x) => hasUnresolvedPlaceholder(x.body))).toBe(true);
  });
  it("dry-run logs only kind, channel, user id and lengths: never the link, name, username or token", async () => {
    const lines: string[] = [];
    const delivery = createDryRunDelivery(createLogger({ level: "debug", sink: (l) => lines.push(l) }));
    await delivery.deliver({
      userId: "11111111-2222-3333-4444-555555555555",
      ghlContactId: "ghl-1",
      username: "dana",
      link,
      expiresAt: new Date(),
      messages: composeSignupMessages(args),
    });
    expect(lines).toHaveLength(1);
    const all = lines.join("\n");
    for (const leak of ["SECRETTOKENVALUE", "activate", "דנה", "dana", "ghl-1", "app.example"]) expect(all).not.toContain(leak);
    expect(JSON.parse(lines[0])).toMatchObject({ kind: "activation", channel: "email", userId: "11111111-2222-3333-4444-555555555555" });
    expect(typeof JSON.parse(lines[0]).bodyLength).toBe("number");
  });
});
