"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { deleteAccountCore } from "@/lib/account/delete";
import { getDeletionNotice } from "@/lib/account/deletion-notice";
import { getSessionSecret } from "@/lib/auth/config";
import { clearSessionCookie } from "@/lib/auth/cookies";
import { verifySession } from "@/lib/auth/dal";
import { assertSameOrigin } from "@/lib/auth/origin";
import { clientIp } from "@/lib/auth/request";
import { logger } from "@/lib/logger";
import type { DeleteState } from "./state";

/**
 * מחיקת חשבון עצמית. סדר: Origin, סשן (החשבון הוא של המחובר בלבד, לא מהטופס), סיסמה + מגבלת קצב, מחיקה (cascade),
 * הודעת מחיקה יבשה (אין שליחה ל־GHL), ניקוי העוגייה ומעבר לדף האישור. ביטול מנוי ההתראות בדפדפן נעשה בדף האישור.
 */
export async function deleteAccountAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const h = await headers();
  assertSameOrigin(h);
  const user = await verifySession();
  if (!user) redirect("/login");

  const raw = formData.get("password");
  const password = typeof raw === "string" ? raw : "";
  if (!password) return { error: "required" };

  let result;
  try {
    result = await deleteAccountCore(getDb(), {
      userId: user.userId,
      password,
      secret: getSessionSecret(),
      ip: clientIp(h),
    });
  } catch (e) {
    logger.error("account deletion failed unexpectedly", { error: e });
    return { error: "generic" };
  }
  if (!result.ok) {
    if (result.reason === "rate_limited") return { error: "tooMany" };
    if (result.reason === "invalid_password") return { error: "invalid" };
    return { error: "generic" };
  }

  try {
    await getDeletionNotice().notify({ hadGhlContact: result.ghlContactId !== null });
  } catch (e) {
    logger.error("account deleted: deletion notice failed", { error: e });
  }
  await clearSessionCookie();
  redirect("/account/deleted");
}
