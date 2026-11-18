import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pendingMigrations } from "./pending-migrations";

const journal = JSON.parse(readFileSync(join(__dirname, "../../drizzle/meta/_journal.json"), "utf8")) as {
  entries: Array<{ idx: number; when: number; tag: string }>;
};
const all = journal.entries.map((e) => e.when);

describe("pendingMigrations", () => {
  it("is empty when every migration in the journal was applied", () => {
    expect(pendingMigrations(journal, all)).toEqual([]);
  });

  it("names the migrations that were not applied, in order", () => {
    // הבאג של 2026-11-16: הקוד של "ההרגלים שלי" עלה בלי 0016, ו־/path נפל ("משהו לא עבד").
    expect(pendingMigrations(journal, all.slice(0, -1))).toEqual(["0017_reminder_log_evening_channels"]);
    expect(pendingMigrations(journal, all.slice(0, 14))).toEqual([
      "0014_users_reminder_time",
      "0015_reminder_log_live_channels",
      "0016_habit_checks",
      "0017_reminder_log_evening_channels",
    ]);
  });

  it("treats an empty database as having every migration pending", () => {
    expect(pendingMigrations(journal, [])).toHaveLength(journal.entries.length);
  });

  it("accepts created_at as the string or bigint a driver returns for bigint columns", () => {
    expect(pendingMigrations(journal, all.map(String))).toEqual([]);
    expect(pendingMigrations(journal, all.map((n) => BigInt(n)))).toEqual([]);
  });

  it("the journal includes the habit_checks migration the /path page needs", () => {
    expect(journal.entries.map((e) => e.tag)).toContain("0016_habit_checks");
  });
});
