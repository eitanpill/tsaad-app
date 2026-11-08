import "server-only";
import { and, eq } from "drizzle-orm";
import { actionCompletions } from "@/db/schema";
import type { Db } from "@/db";
import type { Action } from "@/lib/days";

export type Completion = { day: number; action: Action };

/** הפעולות שסומנו, של המשתמש הזה בלבד. */
export async function listCompletions(db: Db, userId: string): Promise<Completion[]> {
  const rows = await db
    .select({ day: actionCompletions.day, action: actionCompletions.action })
    .from(actionCompletions)
    .where(eq(actionCompletions.userId, userId));
  return rows.map((r) => ({ day: r.day, action: r.action }));
}

export async function listDayCompletions(
  db: Pick<Db, "select">,
  userId: string,
  day: number,
): Promise<Action[]> {
  const rows = await db
    .select({ action: actionCompletions.action })
    .from(actionCompletions)
    .where(and(eq(actionCompletions.userId, userId), eq(actionCompletions.day, day)));
  return rows.map((r) => r.action);
}
