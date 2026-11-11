import { describe, expect, it } from "vitest";
import { assertGuards, parseArgs } from "./admin-create-user";

const ENV = { DATABASE_URL: "postgres://user:secret@ep-x-pooler.eu-central-1.aws.neon.tech/db?sslmode=require", APP_ORIGIN: "https://app.example.test" };

describe("admin-create-user parseArgs", () => {
  it("parses a full create command and normalizes phone, email, username", () => {
    const a = parseArgs(["--username", "Pit", "--name", "פיט", "--email", "Pit@Example.com", "--phone", "050-123-4567", "--confirm-production"]);
    expect(a).toEqual({ username: "pit", name: "פיט", email: "pit@example.com", phone: "+972501234567", newLink: false, confirmProduction: true });
  });
  it("accepts --flag=value, an email without a phone and a phone without an email", () => {
    expect(parseArgs(["--username=avital", "--name=אביטל", "--email=a@example.com"]).phone).toBeUndefined();
    expect(parseArgs(["--username=avital", "--name=אביטל", "--phone=0521234567"]).email).toBeUndefined();
  });
  it("requires username, name and a valid contact", () => {
    expect(() => parseArgs(["--name", "x", "--email", "a@example.com"])).toThrow(/--username/);
    expect(() => parseArgs(["--username", "ab", "--name", "x", "--email", "a@example.com"])).toThrow(/--username/);
    expect(() => parseArgs(["--username", "pit", "--email", "a@example.com"])).toThrow(/--name/);
    expect(() => parseArgs(["--username", "pit", "--name", "פיט"])).toThrow(/email and\/or --phone/);
    expect(() => parseArgs(["--username", "pit", "--name", "פיט", "--email", "nope"])).toThrow(/email and\/or --phone/);
    expect(() => parseArgs(["--username", "pit", "--name", "פיט", "--phone", "123"])).toThrow(/email and\/or --phone/);
  });
  it("rejects unknown flags, missing values and duplicates", () => {
    expect(() => parseArgs(["--username", "pit", "--name", "פיט", "--email", "a@example.com", "--bogus"])).toThrow(/unknown argument/);
    expect(() => parseArgs(["--username", "--name", "x"])).toThrow(/needs a value/);
    expect(() => parseArgs(["--username", "pit", "--username", "pat"])).toThrow(/twice/);
    expect(() => parseArgs(["--username", "pit", "--confirm-production=yes"])).toThrow(/unknown argument/);
  });
  it("--new-link takes only the username", () => {
    expect(parseArgs(["--username", "pit", "--new-link", "--confirm-production"])).toEqual({ username: "pit", newLink: true, confirmProduction: true });
    expect(() => parseArgs(["--username", "pit", "--new-link", "--name", "x"])).toThrow(/only --username/);
  });
});

describe("admin-create-user guards", () => {
  it("refuses without --confirm-production, without DATABASE_URL and without APP_ORIGIN", () => {
    expect(() => assertGuards(ENV, { confirmProduction: false })).toThrow(/--confirm-production/);
    expect(() => assertGuards({ APP_ORIGIN: ENV.APP_ORIGIN }, { confirmProduction: true })).toThrow(/DATABASE_URL/);
    expect(() => assertGuards({ DATABASE_URL: ENV.DATABASE_URL }, { confirmProduction: true })).toThrow(/APP_ORIGIN/);
    expect(() => assertGuards({ ...ENV, DATABASE_URL: "not a url" }, { confirmProduction: true })).toThrow(/DATABASE_URL/);
  });
  it("requires an https APP_ORIGIN (http only for localhost) and normalizes it", () => {
    expect(() => assertGuards({ ...ENV, APP_ORIGIN: "http://app.example.test" }, { confirmProduction: true })).toThrow(/https/);
    expect(() => assertGuards({ ...ENV, APP_ORIGIN: "nonsense" }, { confirmProduction: true })).toThrow(/https/);
    expect(assertGuards({ ...ENV, APP_ORIGIN: "http://localhost:3000" }, { confirmProduction: true }).origin).toBe("http://localhost:3000");
    expect(assertGuards({ ...ENV, APP_ORIGIN: "https://app.example.test/path/" }, { confirmProduction: true }).origin).toBe("https://app.example.test");
  });
  it("TTL defaults to 4320 and comes from ACTIVATION_LINK_TTL_MINUTES; invalid is refused", () => {
    expect(assertGuards(ENV, { confirmProduction: true }).ttlMinutes).toBe(4320);
    expect(assertGuards({ ...ENV, ACTIVATION_LINK_TTL_MINUTES: "60" }, { confirmProduction: true }).ttlMinutes).toBe(60);
    for (const bad of ["0", "-5", "1.5", "abc"]) {
      expect(() => assertGuards({ ...ENV, ACTIVATION_LINK_TTL_MINUTES: bad }, { confirmProduction: true })).toThrow(/TTL|ACTIVATION_LINK_TTL_MINUTES/);
    }
  });
  it("exposes the database host only, never the credentials", () => {
    const g = assertGuards(ENV, { confirmProduction: true });
    expect(g.dbHost).toBe("ep-x-pooler.eu-central-1.aws.neon.tech");
    expect(JSON.stringify({ host: g.dbHost })).not.toContain("secret");
  });
});
