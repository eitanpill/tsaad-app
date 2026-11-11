"use server";

import { headers } from "next/headers";
import { getDb } from "@/db";
import { getSessionSecret } from "@/lib/auth/config";
import { requireUser } from "@/lib/auth/dal";
import { OriginError, assertSameOrigin } from "@/lib/auth/origin";
import { setWhatsappReminderPref } from "@/lib/ghl/preferences";
import { logger } from "@/lib/logger";
import { toggleRateAllowed } from "@/lib/today/toggle";

export type WhatsappToggleResult = { ok: true; on: boolean } | { ok: false };

/** מתג "תזכורת בוואטסאפ": Origin, סשן ומגבלת קצב לפי משתמש (אותה מכסה כמו סימון פעולות). הערך מפורש (אידמפוטנטי). */
export async function setWhatsappRemindersAction(on: boolean): Promise<WhatsappToggleResult> {
  try {
    assertSameOrigin(await headers());
  } catch (e) {
    if (e instanceof OriginError) return { ok: false };
    throw e;
  }
  const user = await requireUser();
  if (typeof on !== "boolean") return { ok: false };
  try {
    const db = getDb();
    if (!(await toggleRateAllowed(db, getSessionSecret(), user.userId))) return { ok: false };
    const saved = await setWhatsappReminderPref(db, user.userId, on);
    if (saved === null) return { ok: false };
    logger.info("whatsapp reminder preference saved", { userId: user.userId, on: saved });
    return { ok: true, on: saved };
  } catch (e) {
    logger.error("setWhatsappRemindersAction failed", { error: e });
    return { ok: false };
  }
}
