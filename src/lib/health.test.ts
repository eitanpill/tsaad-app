// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { checkDb, healthOf } from "./health";

const fakeDb = (execute: () => Promise<unknown>) => (() => ({ execute }) as unknown as Db);

describe("health", () => {
  it("is true when the database answers", async () => {
    expect(await checkDb(fakeDb(async () => [{ "?column?": 1 }]))).toBe(true);
  });
  it("is false on an error, without throwing or leaking it", async () => {
    expect(await checkDb(fakeDb(async () => { throw new Error("password authentication failed for user x at host y"); }))).toBe(false);
  });
  it("is false when getDb itself throws (DATABASE_URL unset)", async () => {
    expect(await checkDb(() => { throw new Error("DATABASE_URL is not set"); })).toBe(false);
  });
  it("is false on timeout", async () => {
    vi.useFakeTimers();
    const p = checkDb(fakeDb(() => new Promise(() => undefined)), 50);
    await vi.advanceTimersByTimeAsync(60);
    expect(await p).toBe(false);
    vi.useRealTimers();
  });
  it("body has exactly ok and db", () => {
    expect(healthOf(true)).toEqual({ ok: true, db: true });
    expect(Object.keys(healthOf(false)).sort()).toEqual(["db", "ok"]);
  });
});
