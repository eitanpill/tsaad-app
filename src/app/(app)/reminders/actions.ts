"use server";

import { headers } from "next/headers";
import { getDb } from "@/db";
import { getSessionSecret } from "@/lib/auth/config";
import { requireUser } from "@/lib/auth/dal";
import { OriginError, assertSameOrigin } from "@/lib/auth/origin";
import { z } from "zod";
import { isReminderMinutes } from "@/lib/days";
import { setReminderTime, setWhatsappReminderPref } from "@/lib/ghl/preferences";
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

export type ReminderTimeState = { status: "idle" } | { status: "saved"; minutes: number } | { status: "error"; minutes?: number };

const reminderTimeSchema = z
  .string()
  .regex(/^[1-9]\d{2,3}$/)
  .transform(Number)
  .refine(isReminderMinutes);

/**
 * שעת התזכורת היומית: server action של טופס (useActionState). Origin, סשן, מגבלת קצב לפי משתמש וולידציה ב־zod
 * (רק אחת מהבחירות: כל 30 דקות, 05:30 עד 21:00). userId מהסשן בלבד. לא שולח כלום: השעה נקראת על ידי ה־cron בלבד.
 */
export async function setReminderTimeAction(_prev: ReminderTimeState, formData: FormData): Promise<ReminderTimeState> {
  try {
    assertSameOrigin(await headers());
  } catch (e) {
    if (e instanceof OriginError) return { status: "error" };
    throw e;
  }
  const user = await requireUser();
  const parsed = reminderTimeSchema.safeParse(formData.get("reminderTime"));
  if (!parsed.success) return { status: "error" };
  try {
    const db = getDb();
    if (!(await toggleRateAllowed(db, getSessionSecret(), user.userId))) return { status: "error" };
    const saved = await setReminderTime(db, user.userId, parsed.data);
    if (saved === null) return { status: "error" };
    logger.info("reminder time saved", { userId: user.userId, minutes: saved });
    return { status: "saved", minutes: saved };
  } catch (e) {
    logger.error("setReminderTimeAction failed", { error: e });
    return { status: "error" };
  }
}
