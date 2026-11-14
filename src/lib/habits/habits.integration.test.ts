// @vitest-environment node
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, isLocalDatabaseUrl, schema, type Db } from "@/db";
import { computeProgress, makeSchedule, stepsFor } from "@/lib/days";
import { rowsOf } from "@/lib/auth/sql";
import { listCompletions } from "@/lib/today/completions";
import { toggleActionCore } from "@/lib/today/toggle";
import { isHabitStepDone, listDayHabitChecks, listHabitChecks, toggleHabitCheckCore } from "./checks";

const url = process.env.DATABASE_URL;
const runIntegration = !!url && process.env.TSAAD_TEST_DB === "1" && isLocalDatabaseUrl(url);

const schedule = makeSchedule("2026-12-01");
const at = (iso: string) => new Date(iso);
// day 4 noon: day 4 is today, 3 is yesterday, 2 and 1 are closed, 5 is locked
const NOON4 = at("2026-12-04T14:00:00+02:00");

describe.skipIf(!runIntegration)("habit checklist (integration)", () => {
  let db: Db;
  let n = 0;
  const mkUser = async () => {
    const i = ++n;
    const [u] = await db
      .insert(schema.users)
      .values({ username: `hb${i}`, displayName: "x", email: `hb${i}@example.test`, ghlContactId: `ghl-hb-${i}` })
      .returning();
    return u.id;
  };
  const habit = (userId: string, day: unknown, habitDay: unknown, now = NOON4, desired?: boolean, syncTracker?: boolean) =>
    toggleHabitCheckCore(db, { userId, day, habitDay, now, schedule, desired, syncTracker });
  const outbox = async () => rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from sync_outbox`))[0].n;

  beforeAll(() => {
    db = createDb(url!);
  });
  afterAll(async () => {
    await db.execute(sql`delete from users where username like 'hb%'`);
  });
  beforeEach(async () => {
    await db.execute(sql`delete from sync_outbox`);
  });

  describe("table CHECKs and uniqueness", () => {
    it("rejects day outside 1..14 and habit_day outside 1..day-1", async () => {
      const u = await mkUser();
      const ins = (day: number, habitDay: number) => db.insert(schema.habitChecks).values({ userId: u, day, habitDay });
      await expect(ins(0, 1)).rejects.toThrow();
      await expect(ins(15, 1)).rejects.toThrow();
      await expect(ins(3, 0)).rejects.toThrow();
      await expect(ins(3, 3)).rejects.toThrow(); // the new habit lives in action_completions
      await expect(ins(3, 4)).rejects.toThrow();
      await expect(ins(1, 1)).rejects.toThrow(); // day 1 has no older habits
      await ins(3, 2);
      await ins(14, 13);
    });
    it("is unique per user, day and habit", async () => {
      const u = await mkUser();
      await db.insert(schema.habitChecks).values({ userId: u, day: 3, habitDay: 1 });
      await expect(db.insert(schema.habitChecks).values({ userId: u, day: 3, habitDay: 1 })).rejects.toThrow();
      await db.insert(schema.habitChecks).values({ userId: u, day: 4, habitDay: 1 }); // a fresh list each day
    });
    it("cascades on user delete", async () => {
      const u = await mkUser();
      await db.insert(schema.habitChecks).values({ userId: u, day: 3, habitDay: 1 });
      await db.delete(schema.users).where(eq(schema.users.id, u));
      expect(await listHabitChecks(db, u)).toEqual([]);
    });
  });

  describe("older habits", () => {
    it("check and uncheck; no cup, no completion, no tracker sync", async () => {
      const u = await mkUser();
      expect(await habit(u, 4, 2)).toMatchObject({ ok: true, checked: true, changed: true });
      expect(await listDayHabitChecks(db, u, 4)).toEqual([2]);
      expect(await listCompletions(db, u)).toEqual([]);
      expect(await outbox()).toBe(0);
      expect(await habit(u, 4, 2)).toMatchObject({ ok: true, checked: false, changed: true });
      expect(await listDayHabitChecks(db, u, 4)).toEqual([]);
    });
    it("is idempotent when desired is given, and concurrent checks leave one row", async () => {
      const u = await mkUser();
      expect(await habit(u, 4, 1, NOON4, true)).toMatchObject({ checked: true, changed: true });
      expect(await habit(u, 4, 1, NOON4, true)).toMatchObject({ checked: true, changed: false });
      expect(await habit(u, 4, 1, NOON4, false)).toMatchObject({ checked: false, changed: true });
      expect(await habit(u, 4, 1, NOON4, false)).toMatchObject({ checked: false, changed: false });
      const rs = await Promise.all([1, 2, 3].map(() => habit(u, 4, 2, NOON4, true)));
      expect(rs.every((r) => r.ok && r.checked)).toBe(true);
      expect(await listDayHabitChecks(db, u, 4)).toEqual([2]);
    });
    it("each day has its own list", async () => {
      const u = await mkUser();
      await habit(u, 4, 1);
      await habit(u, 3, 1); // yesterday
      expect(await listDayHabitChecks(db, u, 4)).toEqual([1]);
      expect(await listDayHabitChecks(db, u, 3)).toEqual([1]);
      await habit(u, 4, 1);
      expect(await listDayHabitChecks(db, u, 4)).toEqual([]);
      expect(await listDayHabitChecks(db, u, 3)).toEqual([1]);
    });
    it("only touches the given user's rows", async () => {
      const a = await mkUser();
      const b = await mkUser();
      await habit(a, 4, 1);
      await habit(b, 4, 2);
      await habit(b, 4, 2);
      expect(await listDayHabitChecks(db, a, 4)).toEqual([1]);
      expect(await listDayHabitChecks(db, b, 4)).toEqual([]);
    });
    it("rejects invalid input and writes nothing", async () => {
      const u = await mkUser();
      for (const [d, h] of [[0, 1], [15, 1], [4, 0], [4, 5], [4, 1.5], ["4", 1], [4, "1"], [4, null], [4, Number.NaN]] as const) {
        expect(await habit(u, d, h)).toEqual({ ok: false, error: "invalid" });
      }
      expect(await listHabitChecks(db, u)).toEqual([]);
    });
  });

  describe("editability (same as the existing ticks)", () => {
    it("yesterday is editable until midnight, then read-only", async () => {
      const u = await mkUser();
      expect(await habit(u, 3, 1, at("2026-12-04T23:59:00+02:00"))).toMatchObject({ ok: true, checked: true });
      expect(await habit(u, 3, 2, at("2026-12-05T00:00:00+02:00"))).toEqual({ ok: false, error: "closed" });
      expect(await habit(u, 3, 1, at("2026-12-05T00:00:00+02:00"))).toEqual({ ok: false, error: "closed" }); // no uncheck either
      expect(await listDayHabitChecks(db, u, 3)).toEqual([1]);
    });
    it("older days are read-only", async () => {
      const u = await mkUser();
      expect(await habit(u, 2, 1)).toEqual({ ok: false, error: "closed" });
      expect(await habit(u, 1, 1)).toEqual({ ok: false, error: "closed" });
      expect(await listHabitChecks(db, u)).toEqual([]);
    });
    it("a locked future day and a missing schedule are not accessible", async () => {
      const u = await mkUser();
      expect(await habit(u, 5, 1)).toEqual({ ok: false, error: "locked" });
      expect(await habit(u, 14, 13)).toEqual({ ok: false, error: "locked" });
      expect(await toggleHabitCheckCore(db, { userId: u, day: 4, habitDay: 1, now: NOON4, schedule: null })).toEqual({ ok: false, error: "locked" });
      expect(await habit(u, 4, 1, at("2026-11-30T12:00:00+02:00"))).toEqual({ ok: false, error: "locked" });
      expect(await listHabitChecks(db, u)).toEqual([]);
    });
    it("a disabled user cannot change anything (older habit or the step)", async () => {
      const u = await mkUser();
      await db.update(schema.users).set({ disabledAt: new Date() }).where(eq(schema.users.id, u));
      expect(await habit(u, 4, 1)).toEqual({ ok: false, error: "forbidden" });
      expect(await habit(u, 4, 4)).toEqual({ ok: false, error: "forbidden" });
      expect(await listHabitChecks(db, u)).toEqual([]);
      expect(await listCompletions(db, u)).toEqual([]);
      expect(await outbox()).toBe(0);
    });
  });

  describe("the new habit IS the existing habit step (single source of truth)", () => {
    it("checking the new habit in the checklist sets the habit step, the cup and the tracker sync", async () => {
      const u = await mkUser();
      expect(await habit(u, 4, 4)).toMatchObject({ ok: true, checked: true, changed: true });
      expect(await isHabitStepDone(db, u, 4)).toBe(true);
      const comps = await listCompletions(db, u);
      expect(comps).toEqual([{ day: 4, action: "habit" }]);
      expect(stepsFor(4, comps.map((c) => c.action))).toBe(1);
      expect(await listHabitChecks(db, u)).toEqual([]); // no second copy
      expect(await outbox()).toBe(1);
      expect(await habit(u, 4, 4)).toMatchObject({ ok: true, checked: false });
      expect(await isHabitStepDone(db, u, 4)).toBe(false);
    });
    it("ticking the habit step through the existing action shows as checked in the checklist", async () => {
      const u = await mkUser();
      await toggleActionCore(db, { userId: u, day: 4, action: "habit", now: NOON4, schedule });
      expect(await isHabitStepDone(db, u, 4)).toBe(true);
      // the checklist (idempotent check) sees it already checked and changes nothing
      expect(await habit(u, 4, 4, NOON4, true)).toMatchObject({ ok: true, checked: true, changed: false });
      // and unchecking from the checklist clears the step
      expect(await habit(u, 4, 4, NOON4, false)).toMatchObject({ ok: true, checked: false, changed: true });
      expect(await listCompletions(db, u)).toEqual([]);
    });
    it("yesterday's new habit is yesterday's habit step", async () => {
      const u = await mkUser();
      expect(await habit(u, 3, 3)).toMatchObject({ ok: true, checked: true });
      expect(await listCompletions(db, u)).toEqual([{ day: 3, action: "habit" }]);
    });
    it("an owner's preview mark of the step never reaches the tracker outbox", async () => {
      const u = await mkUser();
      expect(await habit(u, 4, 4, NOON4, undefined, false)).toMatchObject({ ok: true, checked: true });
      expect(await isHabitStepDone(db, u, 4)).toBe(true);
      expect(await outbox()).toBe(0);
    });
  });

  describe("completion is unaffected by the older habits", () => {
    it("checking every older habit on every day does not count any day", async () => {
      const u = await mkUser();
      for (const day of [3, 4]) for (let h = 1; h < day; h++) await habit(u, day, h);
      expect(await listHabitChecks(db, u)).toHaveLength(5);
      const rows = await listCompletions(db, u);
      expect(rows).toEqual([]);
      const stepsByDay: Record<number, number> = {};
      for (let d = 1; d <= 14; d++) stepsByDay[d] = stepsFor(d, rows.filter((r) => r.day === d).map((r) => r.action));
      expect(computeProgress(stepsByDay, NOON4, schedule).counted).toBe(0);
    });
    it("a day counts with just the new habit, whatever the older ones are", async () => {
      const u = await mkUser();
      await habit(u, 4, 4);
      const rows = await listCompletions(db, u);
      const stepsByDay: Record<number, number> = {};
      for (let d = 1; d <= 14; d++) stepsByDay[d] = stepsFor(d, rows.filter((r) => r.day === d).map((r) => r.action));
      expect(computeProgress(stepsByDay, NOON4, schedule).counted).toBe(1);
    });
  });
});
