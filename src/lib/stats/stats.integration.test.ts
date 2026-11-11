// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, isLocalDatabaseUrl, schema, type Db } from "@/db";
import { recordOfferClick } from "@/lib/offer/clicks";
import { getStats } from "./queries";

const url = process.env.DATABASE_URL;
const runIntegration = !!url && process.env.TSAAD_TEST_DB === "1" && isLocalDatabaseUrl(url);

describe.skipIf(!runIntegration)("owner stats and offer click counters (integration)", () => {
  let db: Db;
  const { users, actionCompletions, pushSubscriptions } = schema;

  const mk = async (name: string, activated: boolean) =>
    (await db.insert(users).values({ username: name, displayName: name, email: `${name}@example.test`, activatedAt: activated ? new Date() : null }).returning())[0].id;
  const mark = (userId: string, day: number, action: "habit" | "move" | "meditate" | "live" = "habit") =>
    db.insert(actionCompletions).values({ userId, day, action });

  beforeAll(() => {
    db = createDb(url!);
  });
  beforeEach(async () => {
    await db.delete(users);
    await db.execute(sql`delete from offer_clicks`);
  });
  afterAll(async () => {
    await db.delete(users);
    await db.execute(sql`delete from offer_clicks`);
  });

  it("is all zeros for an empty database", async () => {
    const s = await getStats(db, "Asia/Jerusalem");
    expect(s.signedUp).toBe(0);
    expect(s.activePerDay).toHaveLength(14);
    expect(s.activePerDay.every((v) => v === 0)).toBe(true);
    expect(s.countedDistribution).toHaveLength(15);
    expect(s.completed).toBe(0);
    expect(s.offerClicks.session).toEqual({ total: 0, last7Days: 0 });
  });

  it("counts signed up, activated, active and returning per day, the distribution, completions and reminders", async () => {
    const a = await mk("sa", true); // days 1,2,3
    const b = await mk("sb", true); // day 1 only
    await mk("sc", true); // nothing
    await mk("sd", false); // signed up, not activated
    for (const d of [1, 2, 3]) await mark(a, d);
    await mark(b, 1);
    // completer: 12 days (day 7 is a live day, use habit only)
    const z = await mk("sz", true);
    for (let d = 1; d <= 12; d++) await mark(z, d);
    await db.insert(pushSubscriptions).values([
      { userId: a, endpoint: "https://fcm.googleapis.com/a1", p256dh: "k", auth: "x" },
      { userId: a, endpoint: "https://fcm.googleapis.com/a2", p256dh: "k", auth: "x" },
      { userId: b, endpoint: "https://fcm.googleapis.com/b1", p256dh: "k", auth: "x" },
    ]);

    const s = await getStats(db, "Asia/Jerusalem");
    expect(s.signedUp).toBe(5);
    expect(s.activated).toBe(4);
    expect(s.activatedLast7Days).toBe(4);
    expect(s.activePerDay.slice(0, 4)).toEqual([3, 2, 2, 1]); // day 1: a,b,z; day 2: a,z; day 3: a,z; day 4: z
    expect(s.returningPerDay.slice(0, 4)).toEqual([0, 2, 2, 1]);
    expect(s.activePerDay[12]).toBe(0);
    expect(s.countedDistribution[0]).toBe(1); // c
    expect(s.countedDistribution[1]).toBe(1); // b
    expect(s.countedDistribution[3]).toBe(1); // a
    expect(s.countedDistribution[12]).toBe(1); // z
    expect(s.countedDistribution.reduce((x, y) => x + y, 0)).toBe(4);
    expect(s.completed).toBe(1);
    expect(s.remindersOptIn).toBe(2); // distinct users, not subscriptions
  });

  it("the result holds numbers only (no names or identifiers)", async () => {
    const a = await mk("secretname", true);
    await mark(a, 1);
    const s = await getStats(db, "Asia/Jerusalem");
    expect(JSON.stringify(s)).not.toMatch(/secretname|example\.test/);
  });

  it("offer clicks: atomic upsert per offer and local day, concurrent clicks are not lost", async () => {
    await Promise.all(Array.from({ length: 10 }, () => recordOfferClick(db, "session", "Asia/Jerusalem")));
    await recordOfferClick(db, "yesodot", "Asia/Jerusalem");
    await db.execute(sql`insert into offer_clicks (offer, day, clicks) values ('session', current_date - 30, 4)`);
    const s = await getStats(db, "Asia/Jerusalem");
    expect(s.offerClicks.session).toEqual({ total: 14, last7Days: 10 });
    expect(s.offerClicks.yesodot).toEqual({ total: 1, last7Days: 1 });
    expect(s.offerClicks.bundle).toEqual({ total: 0, last7Days: 0 });
    await expect(db.execute(sql`insert into offer_clicks (offer, day, clicks) values ('evil', current_date, 1)`)).rejects.toThrow();
  });
});
