import "server-only";
import { and, eq } from "drizzle-orm";
import { actionCompletions, habitChecks, users } from "@/db/schema";
import type { Db } from "@/db";
import { markState, type Schedule } from "@/lib/days";
import { toggleActionCore } from "@/lib/today/toggle";
import { isHabitStepHabit } from "./rule";

export type HabitToggleError = "invalid" | "locked" | "closed" | "forbidden";

export type HabitToggleResult =
  | { ok: true; day: number; habitDay: number; checked: boolean; changed: boolean }
  | { ok: false; error: HabitToggleError };

/** ההרגלים הישנים שסומנו ביום אחד (habit_day < day), של המשתמש הזה בלבד. */
export async function listDayHabitChecks(db: Pick<Db, "select">, userId: string, day: number): Promise<number[]> {
  const rows = await db
    .select({ habitDay: habitChecks.habitDay })
    .from(habitChecks)
    .where(and(eq(habitChecks.userId, userId), eq(habitChecks.day, day)));
  return rows.map((r) => r.habitDay).sort((a, b) => a - b);
}

/** כל ההרגלים הישנים שסומנו, לכל הימים: [{ day, habitDay }]. */
export async function listHabitChecks(db: Pick<Db, "select">, userId: string): Promise<Array<{ day: number; habitDay: number }>> {
  return db
    .select({ day: habitChecks.day, habitDay: habitChecks.habitDay })
    .from(habitChecks)
    .where(eq(habitChecks.userId, userId));
}

/** האם שלב ה"הרגל" של היום סומן. */
export async function isHabitStepDone(db: Pick<Db, "select">, userId: string, day: number): Promise<boolean> {
  const rows = await db
    .select({ id: actionCompletions.id })
    .from(actionCompletions)
    .where(and(eq(actionCompletions.userId, userId), eq(actionCompletions.day, day), eq(actionCompletions.action, "habit")))
    .limit(1);
  return rows.length > 0;
}

/**
 * סימון או ביטול של הרגל אחד ברשימה, לפי כללי השרת (בלי אמון בלקוח), באותם כללי עריכה כמו סימון פעולות:
 *  - day 1..totalDays ו־habitDay 1..day (שלמים), אחרת "invalid". אין לוח (START_DATE) או יום שעוד לא נפתח: "locked".
 *    יום שנסגר (אחרי חצות של אתמול): "closed". משתמש מושבת: "forbidden" (שכבה נוספת מעל דחיית הסשן).
 *  - ההרגל שהוא שלב ה"הרגל" (כרגע: ההרגל החדש של היום, ראו rule.ts) הוא סימון השלב הקיים: מועבר ל־toggleActionCore,
 *    כולל הכוס, ה־12 מתוך 14 וסנכרון המעקב (ו־syncTracker=false בתצוגה מקדימה של מנהל).
 *  - שאר ההרגלים נשמרים ב־habit_checks: insert ... on conflict do nothing / delete. אידמפוטנטי כש־desired נתון.
 *    הם לא נוגעים בכוס, בספירה או בתור הסנכרון, ולכן אין בהם סנכרון.
 * userId תמיד מגיע מהסשן: אי אפשר לגעת בנתוני משתמש אחר.
 */
export async function toggleHabitCheckCore(
  db: Db,
  args: {
    userId: string;
    day: unknown;
    habitDay: unknown;
    desired?: boolean;
    now: Date;
    schedule: Schedule | null;
    syncTracker?: boolean;
  },
): Promise<HabitToggleResult> {
  const { userId, now, schedule, day, habitDay } = args;
  if (!schedule) return { ok: false, error: "locked" };
  if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > schedule.totalDays) {
    return { ok: false, error: "invalid" };
  }
  if (typeof habitDay !== "number" || !Number.isInteger(habitDay) || habitDay < 1 || habitDay > day) {
    return { ok: false, error: "invalid" };
  }
  const state = markState(day, now, schedule);
  if (!state.ok) return { ok: false, error: state.reason };

  const [u] = await db.select({ disabledAt: users.disabledAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u || u.disabledAt !== null) return { ok: false, error: "forbidden" };

  if (isHabitStepHabit(day, habitDay)) {
    const r = await toggleActionCore(db, {
      userId,
      day,
      action: "habit",
      desired: args.desired,
      now,
      schedule,
      syncTracker: args.syncTracker,
    });
    if (!r.ok) return { ok: false, error: r.error === "rate_limited" ? "forbidden" : r.error };
    return { ok: true, day, habitDay, checked: r.done, changed: r.changed };
  }

  return db.transaction(async (tx) => {
    const existing = (await listDayHabitChecks(tx, userId, day)).includes(habitDay);
    const want = args.desired ?? !existing;
    let changed = false;
    if (want && !existing) {
      const inserted = await tx
        .insert(habitChecks)
        .values({ userId, day, habitDay })
        .onConflictDoNothing()
        .returning({ id: habitChecks.id });
      changed = inserted.length > 0;
    } else if (!want && existing) {
      const deleted = await tx
        .delete(habitChecks)
        .where(and(eq(habitChecks.userId, userId), eq(habitChecks.day, day), eq(habitChecks.habitDay, habitDay)))
        .returning({ id: habitChecks.id });
      changed = deleted.length > 0;
    }
    return { ok: true as const, day, habitDay, checked: (await listDayHabitChecks(tx, userId, day)).includes(habitDay), changed };
  });
}
