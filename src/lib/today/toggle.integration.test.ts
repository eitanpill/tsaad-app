// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, isLocalDatabaseUrl, schema, type Db } from "@/db";
import { makeSchedule } from "@/lib/days";
import { rowsOf } from "@/lib/auth/sql";
import { listCompletions } from "./completions";
import { toggleActionCore } from "./toggle";

const url = process.env.DATABASE_URL;
const runIntegration = !!url && process.env.TSAAD_TEST_DB === "1" && isLocalDatabaseUrl(url);

const schedule = makeSchedule("2026-12-01");
const at = (iso: string) => new Date(iso);
// day 4 noon: day 3 is "yesterday", day 5 is locked, day 2 is closed
const NOON4 = at("2026-12-04T14:00:00+02:00");

describe.skipIf(!runIntegration)("toggleActionCore (integration)", () => {
  let db: Db;
  let n = 0;
  const mkUser = async () => {
    const i = ++n;
    const [u] = await db
      .insert(schema.users)
      .values({ username: `tg${i}`, displayName: "x", email: `tg${i}@example.test`, ghlContactId: `ghl-tg-${i}` })
      .returning();
    return u.id;
  };
  const toggle = (userId: string, day: unknown, action: unknown, now = NOON4, desired?: boolean) =>
    toggleActionCore(db, { userId, day, action, now, schedule, desired });
  const outbox = async () =>
    rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from sync_outbox`))[0].n;

  beforeAll(() => {
    db = createDb(url!);
  });
  afterAll(async () => {
    await db.execute(sql`delete from users where username like 'tg%'`);
  });
  beforeEach(async () => {
    await db.execute(sql`delete from sync_outbox`);
  });

  it("marks and unmarks the current day, and the cup steps follow", async () => {
    const u = await mkUser();
    expect(await toggle(u, 4, "habit")).toMatchObject({ ok: true, done: true, steps: 1, changed: true });
    expect(await toggle(u, 4, "move")).toMatchObject({ ok: true, done: true, steps: 2 });
    expect(await toggle(u, 4, "habit")).toMatchObject({ ok: true, done: false, steps: 1 });
    expect((await listCompletions(db, u)).map((c) => c.action)).toEqual(["move"]);
  });

  it("is idempotent when the desired state is given (a retry never flips it)", async () => {
    const u = await mkUser();
    expect(await toggle(u, 4, "habit", NOON4, true)).toMatchObject({ ok: true, done: true, changed: true });
    expect(await toggle(u, 4, "habit", NOON4, true)).toMatchObject({ ok: true, done: true, changed: false });
    expect(await toggle(u, 4, "habit", NOON4, false)).toMatchObject({ ok: true, done: false, changed: true });
    expect(await toggle(u, 4, "habit", NOON4, false)).toMatchObject({ ok: true, done: false, changed: false });
    expect(await listCompletions(db, u)).toEqual([]);
  });

  it("concurrent identical marks leave exactly one row", async () => {
    const u = await mkUser();
    const rs = await Promise.all([1, 2, 3, 4].map(() => toggle(u, 4, "habit", NOON4, true)));
    expect(rs.every((r) => r.ok && r.done)).toBe(true);
    expect(await listCompletions(db, u)).toHaveLength(1);
  });

  it("rejects a locked day and writes nothing", async () => {
    const u = await mkUser();
    expect(await toggle(u, 5, "habit")).toEqual({ ok: false, error: "locked" });
    expect(await toggle(u, 14, "habit")).toEqual({ ok: false, error: "locked" });
    expect(await listCompletions(db, u)).toEqual([]);
    expect(await outbox()).toBe(0);
  });

  it("rejects a closed day (older than yesterday)", async () => {
    const u = await mkUser();
    expect(await toggle(u, 2, "habit")).toEqual({ ok: false, error: "closed" });
    expect(await toggle(u, 1, "habit")).toEqual({ ok: false, error: "closed" });
    expect(await listCompletions(db, u)).toEqual([]);
  });

  it("yesterday is markable until 24:00 Israel time, and not a second after", async () => {
    const u = await mkUser();
    expect(await toggle(u, 3, "habit", at("2026-12-04T23:59:59+02:00"))).toMatchObject({ ok: true, done: true });
    // 00:00 of the next date: day 3 closes (day 4 is still the current day until 05:00)
    expect(await toggle(u, 3, "move", at("2026-12-05T00:00:00+02:00"))).toEqual({ ok: false, error: "closed" });
    expect(await toggle(u, 4, "habit", at("2026-12-05T00:00:00+02:00"))).toMatchObject({ ok: true });
    // the day after 05:00 makes day 4 "yesterday"
    expect(await toggle(u, 4, "move", at("2026-12-05T06:00:00+02:00"))).toMatchObject({ ok: true });
  });

  it("day 14 stays markable after the challenge ended, until midnight", async () => {
    const u = await mkUser();
    expect(await toggle(u, 14, "habit", at("2026-12-15T10:00:00+02:00"))).toMatchObject({ ok: true });
    expect(await toggle(u, 14, "habit", at("2026-12-16T00:00:00+02:00"))).toEqual({ ok: false, error: "closed" });
  });

  it("live days: habit + live; live counts two steps; move/meditate are refused (and vice versa)", async () => {
    const u = await mkUser();
    const d7 = at("2026-12-07T10:00:00+02:00");
    expect(await toggle(u, 7, "live", d7)).toMatchObject({ ok: true, steps: 2 });
    expect(await toggle(u, 7, "habit", d7)).toMatchObject({ ok: true, steps: 3 });
    expect(await toggle(u, 7, "move", d7)).toEqual({ ok: false, error: "invalid" });
    expect(await toggle(u, 7, "meditate", d7)).toEqual({ ok: false, error: "invalid" });
    expect(await toggle(u, 4, "live")).toEqual({ ok: false, error: "invalid" });
  });

  it("rejects malformed input", async () => {
    const u = await mkUser();
    for (const day of [0, 15, -1, 1.5, "4", null, undefined, NaN]) {
      expect(await toggle(u, day, "habit")).toEqual({ ok: false, error: "invalid" });
    }
    for (const action of ["", "sleep", "HABIT", 3, null, undefined, "habit; drop table users"]) {
      expect(await toggle(u, 4, action)).toEqual({ ok: false, error: "invalid" });
    }
    expect(await listCompletions(db, u)).toEqual([]);
  });

  it("without a configured start date nothing can be marked", async () => {
    const u = await mkUser();
    expect(await toggleActionCore(db, { userId: u, day: 1, action: "habit", now: NOON4, schedule: null })).toEqual({
      ok: false,
      error: "locked",
    });
  });

  it("users are isolated: one user's marks never appear for, or change, another's", async () => {
    const a = await mkUser();
    const b = await mkUser();
    await toggle(a, 4, "habit", NOON4, true);
    expect(await listCompletions(db, b)).toEqual([]);
    // b unmarking the same slot does nothing to a
    expect(await toggle(b, 4, "habit", NOON4, false)).toMatchObject({ ok: true, done: false, changed: false });
    expect(await listCompletions(db, a)).toHaveLength(1);
    expect(await toggle(b, 4, "habit", NOON4, true)).toMatchObject({ ok: true, done: true });
    await toggle(b, 4, "habit", NOON4, false);
    expect(await listCompletions(db, a)).toHaveLength(1);
  });

  it("queues exactly one tracker row per user and day (no network), only when something changed", async () => {
    const u = await mkUser();
    await toggle(u, 4, "habit", NOON4, true);
    expect(await outbox()).toBe(1);
    await toggle(u, 4, "habit", NOON4, true); // no change
    expect(await outbox()).toBe(1);
    await toggle(u, 4, "move", NOON4, true); // same (user, day): deduped, row updated
    expect(await outbox()).toBe(1);
    await toggle(u, 3, "habit", NOON4, true); // another day
    expect(await outbox()).toBe(2);
    const row = rowsOf<{ payload: { counted_days: number; day: number } }>(
      await db.execute(sql`select payload from sync_outbox where dedupe_key like ${"%:" + u + ":4"}`),
    )[0];
    expect(row.payload).toMatchObject({ day: 4, counted_days: 1 });
    expect(JSON.stringify(row.payload)).not.toMatch(/example\.test|tg\d/);
  });
});
