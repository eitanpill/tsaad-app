// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { SYNC } from "@/config/constants";
import { createMockSyncAdapter, getSyncAdapter } from "./adapter";
import { backoffSeconds } from "./backoff";
import { sanitizeError } from "./outbox";
import { trackerPayloadSchema } from "./payload";
import { runSyncWorker } from "./worker";

/** db שזורק על כל שימוש: מוכיח שהוורקר לא נוגע במסד. */
const explodingDb = new Proxy({}, { get: () => { throw new Error("db must not be touched"); } }) as unknown as Db;

describe("backoffSeconds", () => {
  it("doubles per attempt (no jitter) and caps", () => {
    const r = () => 0;
    expect(backoffSeconds(1, r)).toBe(60);
    expect(backoffSeconds(2, r)).toBe(120);
    expect(backoffSeconds(3, r)).toBe(240);
    expect(backoffSeconds(4, r)).toBe(480);
    expect(backoffSeconds(30, r)).toBe(SYNC.backoffMaxSeconds);
    expect(backoffSeconds(1000, r)).toBe(SYNC.backoffMaxSeconds);
  });
  it("jitters downward within [1-jitter, 1] of the delay", () => {
    for (const attempts of [1, 3, 6]) {
      const full = backoffSeconds(attempts, () => 0);
      const low = backoffSeconds(attempts, () => 0.999999);
      expect(low).toBeLessThan(full);
      expect(low).toBeGreaterThanOrEqual(Math.floor(full * (1 - SYNC.jitter)));
    }
  });
  it("treats attempts below 1 as 1", () => {
    expect(backoffSeconds(0, () => 0)).toBe(60);
    expect(backoffSeconds(-5, () => 0)).toBe(60);
  });
});

describe("sanitizeError", () => {
  it("redacts emails, urls, bearer tokens and phones, and truncates", () => {
    const s = sanitizeError(
      new Error("POST https://hooks.example/secretpath failed for dana@example.com phone 052-123-4567 Bearer abc.def"),
    );
    for (const leak of ["hooks.example", "secretpath", "dana@", "052-123", "abc.def"]) {
      expect(s).not.toContain(leak);
    }
    const long = sanitizeError(new Error("x".repeat(5000)));
    expect(long.length).toBeLessThanOrEqual(SYNC.maxErrorLength);
  });
});

describe("tracker payload schema", () => {
  const ok = {
    ghl_contact_id: "c1",
    day: 3,
    counted_days: 2,
    completed: false,
    live_attendance: { day7: null, day14: null },
  };
  it("accepts the whitelisted shape", () => {
    expect(trackerPayloadSchema.safeParse(ok).success).toBe(true);
  });
  it("rejects any extra (PII) field, top level or nested", () => {
    for (const extra of ["email", "phone", "name", "username", "token", "displayName"]) {
      expect(trackerPayloadSchema.safeParse({ ...ok, [extra]: "x" }).success).toBe(false);
    }
    expect(
      trackerPayloadSchema.safeParse({ ...ok, live_attendance: { day7: true, day14: null, email: "x" } }).success,
    ).toBe(false);
  });
  it("rejects out-of-range days", () => {
    expect(trackerPayloadSchema.safeParse({ ...ok, day: 0 }).success).toBe(false);
    expect(trackerPayloadSchema.safeParse({ ...ok, day: 15 }).success).toBe(false);
  });
});

describe("sync worker under default settings", () => {
  it("enabled=false: touches neither the db nor the adapter", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const adapter = createMockSyncAdapter();
    const r = await runSyncWorker({ db: explodingDb, enabled: false, adapter });
    expect(r).toEqual({ enabled: false, claimed: 0, sent: 0, failed: 0, dead: 0 });
    expect(adapter.calls).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
  it("anything but boolean true is disabled", async () => {
    for (const v of ["true", 1, undefined, null] as unknown[]) {
      const r = await runSyncWorker({ db: explodingDb, enabled: v as boolean, adapter: createMockSyncAdapter() });
      expect(r.enabled).toBe(false);
    }
  });
  it("enabled but no adapter wired: nothing processed, db untouched", async () => {
    expect(getSyncAdapter()).toBeNull();
    const r = await runSyncWorker({ db: explodingDb, enabled: true, adapter: getSyncAdapter() });
    expect(r).toMatchObject({ enabled: true, claimed: 0 });
  });
});
