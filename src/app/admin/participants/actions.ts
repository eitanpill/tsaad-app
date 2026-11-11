"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { getConfig } from "@/config";
import { copy } from "@/content/copy.he";
import { getDb } from "@/db";
import { getDeletionNotice } from "@/lib/account/deletion-notice";
import {
  createParticipant,
  deleteParticipant,
  disableParticipant,
  enableParticipant,
  findParticipant,
  issueParticipantLink,
} from "@/lib/admin/participants";
import { adminGate } from "@/lib/admin/guard";
import { getActivationTtlMinutes, getAppOrigin, getSessionSecret } from "@/lib/auth/config";
import { fill } from "@/lib/format";
import { logger } from "@/lib/logger";
import { previewCookieName, previewCookieOptions } from "@/lib/preview/context";
import { isPreviewDay, signPreviewCookie } from "@/lib/preview/cookie";
import { cookies } from "next/headers";
import type { AdminState, ErrorKey } from "./state";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v : "";
};
const err = (error: ErrorKey): AdminState => ({ status: "error", error });

/** תוקף הקישור לתצוגה: תאריך ושעה מקומיים. */
function untilText(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short", timeZone: getConfig().timeZone }).format(d);
}

async function linkBase(): Promise<string> {
  return getAppOrigin() ?? `http://${(await headers()).get("host") ?? "localhost"}`;
}

/**
 * כל הפעולות: שער (Origin, מנהל, קצב), ביצוע, שורת audit בלי ערכים אישיים (מזהים בלבד), ורק אז תשובה.
 * הקישור החד־פעמי מוחזר רק בתשובה ואינו נרשם ביומן.
 */
export async function addParticipantAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const gate = await adminGate();
  if (!gate.ok) return err(gate.error);
  try {
    const r = await createParticipant(getDb(), {
      displayName: str(formData, "name"),
      email: str(formData, "email"),
      phone: str(formData, "phone"),
      ttlMinutes: getActivationTtlMinutes(),
    });
    if (!r.ok) return err(r.error === "invalid_name" ? "invalidName" : r.error === "invalid_contact" ? "invalidContact" : "generic");
    logger.info("admin: participant created", { actorId: gate.actor.userId, targetId: r.userId });
    refresh(); // the list shows the new participant; the form keeps its one-time link in memory
    return {
      status: "link",
      link: `${await linkBase()}/activate?token=${r.link.token}`,
      purpose: "activate",
      name: str(formData, "name").trim(),
      username: r.username,
      until: untilText(r.link.expiresAt),
    };
  } catch (e) {
    logger.error("admin: create participant failed", { error: e });
    return err("generic");
  }
}

export async function newLinkAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const gate = await adminGate();
  if (!gate.ok) return err(gate.error);
  const id = str(formData, "id");
  if (!UUID.test(id)) return err("notFound");
  try {
    const r = await issueParticipantLink(getDb(), { userId: id, ttlMinutes: getActivationTtlMinutes() });
    if (!r.ok) return err(r.error === "disabled" ? "disabledUser" : "notFound");
    logger.info("admin: link issued", { actorId: gate.actor.userId, targetId: r.userId, purpose: r.purpose });
    return {
      status: "link",
      link: `${await linkBase()}/activate?token=${r.link.token}`,
      purpose: r.purpose,
      name: str(formData, "name").trim(),
      username: r.username,
      until: untilText(r.link.expiresAt),
    };
  } catch (e) {
    logger.error("admin: issue link failed", { error: e });
    return err("generic");
  }
}

export async function setDisabledAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const gate = await adminGate();
  if (!gate.ok) return err(gate.error);
  const id = str(formData, "id");
  if (!UUID.test(id)) return err("notFound");
  const disable = str(formData, "disable") === "1";
  const name = str(formData, "name").trim();
  try {
    const r = disable
      ? await disableParticipant(getDb(), { userId: id, actorId: gate.actor.userId })
      : await enableParticipant(getDb(), { userId: id });
    if (!r.ok) return err(r.error === "self" ? "self" : "notFound");
    logger.info(disable ? "admin: participant disabled" : "admin: participant enabled", { actorId: gate.actor.userId, targetId: id });
    refresh(); // the row's state, tag and button change at once (focus stays on the same button)
    return { status: "done", message: fill(disable ? copy.admin.participants.done.disabled : copy.admin.participants.done.enabled, { name }) };
  } catch (e) {
    logger.error("admin: set disabled failed", { error: e });
    return err("generic");
  }
}

/** מחיקה לצמיתות. שלב ב': חייבים להקליד את שם המשתמש (נבדק בשרת מול המסד). */
export async function deleteParticipantAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const gate = await adminGate();
  if (!gate.ok) return err(gate.error);
  const id = str(formData, "id");
  if (!UUID.test(id)) return err("notFound");
  let ok = false;
  try {
    const db = getDb();
    const target = await findParticipant(db, id);
    if (!target) return err("notFound");
    if (str(formData, "confirm").trim().toLowerCase() !== target.username) return err("confirmMismatch");
    const r = await deleteParticipant(db, { userId: id, actorId: gate.actor.userId });
    if (!r.ok) return err(r.error === "self" ? "self" : "notFound");
    logger.info("admin: participant deleted", { actorId: gate.actor.userId, targetId: id });
    try {
      await getDeletionNotice().notify({ hadGhlContact: r.hadGhlContact });
    } catch (e) {
      logger.error("admin: deletion notice failed", { error: e });
    }
    ok = true;
  } catch (e) {
    logger.error("admin: delete participant failed", { error: e });
    return err("generic");
  }
  if (ok) redirect("/admin/participants?deleted=1");
  return err("generic");
}

export async function startPreviewAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const gate = await adminGate();
  if (!gate.ok) return err(gate.error);
  const raw = str(formData, "day");
  const day = /^\d{1,2}$/.test(raw) ? Number(raw) : NaN;
  if (!isPreviewDay(day)) return err("invalidDay");
  try {
    const { value, maxAge } = signPreviewCookie(getSessionSecret(), gate.actor.userId, day, Date.now());
    (await cookies()).set(previewCookieName(), value, previewCookieOptions(maxAge));
    logger.info("admin: preview started", { actorId: gate.actor.userId, day });
  } catch (e) {
    logger.error("admin: preview start failed", { error: e });
    return err("generic");
  }
  redirect("/today");
}

/** מופעל גם מהבאנר שבמסכי האפליקציה. Origin ומנהל נבדקים; מוחק את העוגייה ומחזיר לדף הניהול. */
export async function stopPreviewAction(): Promise<void> {
  const gate = await adminGate({ rateLimit: false });
  if (!gate.ok) return;
  (await cookies()).set(previewCookieName(), "", previewCookieOptions(0));
  logger.info("admin: preview stopped", { actorId: gate.actor.userId });
  redirect("/admin/participants");
}
