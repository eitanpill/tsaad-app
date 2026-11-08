// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertDevEnvironment, hashToken, parseArgs } from "./create-dev-user";

const local = "postgres://postgres@127.0.0.1:5432/x";

describe("create-dev-user guards", () => {
  it("requires NODE_ENV=development", () => {
    for (const NODE_ENV of [undefined, "production", "test", "Development"]) {
      expect(() => assertDevEnvironment({ NODE_ENV, DATABASE_URL: local })).toThrow(/NODE_ENV/);
    }
  });
  it("requires a localhost DATABASE_URL", () => {
    expect(assertDevEnvironment({ NODE_ENV: "development", DATABASE_URL: local })).toBe(local);
    expect(assertDevEnvironment({ NODE_ENV: "development", DATABASE_URL: "postgres://u@localhost/x" })).toBeTruthy();
    for (const DATABASE_URL of [undefined, "", "postgres://u@ep-x.neon.tech/x", "postgres://u@localhost.evil.com/x", "postgres://127.0.0.1@evil.com/x", "garbage"]) {
      expect(() => assertDevEnvironment({ NODE_ENV: "development", DATABASE_URL })).toThrow(/DATABASE_URL/);
    }
  });
  it("parses args and hashes tokens", () => {
    expect(parseArgs(["--username", "Dana", "--name", "דנה", "--email", "d@example.test"])).toMatchObject({ username: "dana" });
    expect(() => parseArgs(["--username", "x"])).toThrow();
    expect(hashToken("a")).toHaveLength(64);
  });
});
