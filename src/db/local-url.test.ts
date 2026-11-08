// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isLocalDatabaseUrl } from "./local-url";

describe("isLocalDatabaseUrl", () => {
  it("accepts loopback hosts", () => {
    for (const u of [
      "postgres://u@localhost:5432/x",
      "postgresql://u:p@127.0.0.1:1/x",
      "postgres://u@[::1]:5432/x",
      "postgres://u@LOCALHOST/x",
      "postgres://u@localhost/x?sslmode=disable",
    ]) expect(isLocalDatabaseUrl(u), u).toBe(true);
  });

  it("rejects remote hosts, lookalikes and host overrides", () => {
    for (const u of [
      "postgres://u@db.example.com/x",
      "postgres://u@localhost.evil.com/x",
      "postgres://u@127.0.0.1.nip.io/x",
      "postgres://localhost:x@evil.com/x",
      "postgres://127.0.0.1@evil.com/x",
      "postgres://u@localhost/x?host=evil.com",
      "postgres://u@localhost/x?HOST=evil.com",
      "postgres://u@127.0.0.1/x?hostaddr=1.2.3.4",
      "postgres://u@localhost/x?host=/var/run/postgresql",
      "postgres://u@localhost/x?service=prod",
      "postgres:///x",
      "http://localhost/x",
      "not a url",
      "",
    ]) expect(isLocalDatabaseUrl(u), u).toBe(false);
  });
});
