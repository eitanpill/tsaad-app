"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { getSessionSecret } from "@/lib/auth/config";
import { requireUser } from "@/lib/auth/dal";
import { OriginError, assertSameOrigin } from "@/lib/auth/origin";
import { toggleHabitCheckCore, type HabitToggleResult } from "@/lib/habits/checks";
import { logger } from "@/lib/logger";
import { getAppClock } from "@/lib/preview/context";
import { toggleRateAllowed } from "@/lib/today/toggle";

export type ToggleHabitResult = HabitToggleResult | { ok: false; error: "rate_limited" | "failed" };

const input = z
  .object({
    day: z.number().int().min(1).max(14),
    habitDay: z.number().int().min(1).max(14),
    desired: z.boolean().optional(),
  })
  .refine((v) => v.habitDay <= v.day);

/**
 * סימון/ביטול של הרגל אחד ברשימת "ההרגלים שלי". Origin, סשן, מגבלת קצב לפי משתמש (אותה מכסה כמו סימון פעולות),
 * ולידציה ב־zod (day 1..14, habitDay 1..day) ושעון השרת נבדקים כאן; כללי העריכה (היום ואתמול עד חצות) נאכפים ב־toggleHabitCheckCore.
 * userId מהסשן בלבד. ההרגל החדש של היום הוא שלב ה"הרגל" הקיים (כוס, ספירה, סנכרון), וכך גם בתצוגה מקדימה של מנהל: בלי סנכרון.
 */
export async function toggleHabit(day: number, habitDay: number, desired?: boolean): Promise<ToggleHabitResult> {
  try {
    assertSameOrigin(await headers());
  } catch (e) {
    if (e instanceof OriginError) return { ok: false, error: "forbidden" };
    throw e;
  }
  const user = await requireUser();
  const parsed = input.safeParse({ day, habitDay, desired: typeof desired === "boolean" ? desired : undefined });
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const db = getDb();
    if (!(await toggleRateAllowed(db, getSessionSecret(), user.userId))) {
      logger.warn("toggleHabit rate limited");
      return { ok: false, error: "rate_limited" };
    }
    const clock = await getAppClock();
    return await toggleHabitCheckCore(db, {
      userId: user.userId,
      day: parsed.data.day,
      habitDay: parsed.data.habitDay,
      desired: parsed.data.desired,
      now: clock.now,
      schedule: clock.schedule,
      // like toggleAction: a preview-day mark stays in the app and never reaches the GHL tracker
      syncTracker: clock.previewDay === null,
    });
  } catch (e) {
    logger.error("toggleHabit failed", { error: e });
    return { ok: false, error: "failed" };
  }
}
