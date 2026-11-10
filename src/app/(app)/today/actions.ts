"use server";

import { headers } from "next/headers";
import { getDb } from "@/db";
import { getSessionSecret } from "@/lib/auth/config";
import { requireUser } from "@/lib/auth/dal";
import { OriginError, assertSameOrigin } from "@/lib/auth/origin";
import { logger } from "@/lib/logger";
import { serverNow } from "@/lib/today/clock";
import { getSchedule } from "@/lib/today/schedule";
import { toggleActionCore, toggleRateAllowed, type ToggleResult } from "@/lib/today/toggle";

export type ToggleActionResult = ToggleResult | { ok: false; error: "forbidden" | "failed" };

/**
 * סימון/ביטול סימון של פעולה. Origin, סשן, מגבלת קצב לפי משתמש ושעון השרת נבדקים כאן. `desired` (אופציונלי) הופך את הקריאה לאידמפוטנטית.
 * אין כאן שמירה לא־מקוונת: בלי רשת הקריאה נכשלת והלקוח מציג "לנסות שוב" (תור לא־מקוון הוא שלב 9).
 */
export async function toggleAction(
  day: number,
  action: string,
  desired?: boolean,
): Promise<ToggleActionResult> {
  try {
    assertSameOrigin(await headers());
  } catch (e) {
    if (e instanceof OriginError) return { ok: false, error: "forbidden" };
    throw e;
  }
  const user = await requireUser();
  try {
    const db = getDb();
    if (!(await toggleRateAllowed(db, getSessionSecret(), user.userId))) {
      logger.warn("toggleAction rate limited");
      return { ok: false, error: "rate_limited" };
    }
    return await toggleActionCore(db, {
      userId: user.userId,
      day,
      action,
      desired: typeof desired === "boolean" ? desired : undefined,
      now: await serverNow(),
      schedule: getSchedule(),
    });
  } catch (e) {
    logger.error("toggleAction failed", { error: e });
    return { ok: false, error: "failed" };
  }
}
