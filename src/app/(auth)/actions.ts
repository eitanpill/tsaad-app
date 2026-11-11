"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { logger } from "@/lib/logger";
import { getMessageSender } from "@/lib/messaging/sender";
import { completePasswordSetup } from "@/lib/auth/accounts";
import {
  FORGOT_MIN_RESPONSE_MS,
  POST_LOGIN_PATH,
  getActivationTtlMinutes,
  getAppOrigin,
  getSessionSecret,
} from "@/lib/auth/config";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "@/lib/auth/cookies";
import { IDENTIFIER_MAX_LENGTH, requestPasswordReset } from "@/lib/auth/forgot";
import { authenticate, clearLoginLimitsForUser } from "@/lib/auth/login";
import { assertSameOrigin } from "@/lib/auth/origin";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { clientIp } from "@/lib/auth/request";
import { deleteSession, rotateSession } from "@/lib/auth/session";
import { peekToken } from "@/lib/auth/tokens";
import { removeSubscriptionForSession } from "@/lib/push/subscription";
import type { ActivateState, ForgotState, LoginState } from "./state";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** כניסה עם שם משתמש, טלפון או מייל. כל כשל זהה כלפי חוץ. */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const h = await headers();
  assertSameOrigin(h);
  const username = str(formData.get("username")).trim();
  const password = str(formData.get("password"));
  if (!username) return { error: "usernameRequired" };
  if (!password) return { error: "passwordRequired", username };

  let result;
  try {
    result = await authenticate(getDb(), {
      identifier: username,
      password,
      secret: getSessionSecret(),
      ip: clientIp(h),
    });
  } catch (e) {
    logger.error("login failed unexpectedly", { error: e });
    return { error: "generic", username };
  }
  if (!result.ok) {
    return { error: result.reason === "rate_limited" ? "tooMany" : "invalid", username };
  }

  // סיבוב: ההפעלה הקודמת של הדפדפן (אם יש) נמחקת, ונוצרת אחת חדשה.
  // כשל במסד כאן (אחרי שהסיסמה אומתה) מציג את אותה שגיאה ידידותית ולא דף קריסה. redirect מחוץ ל־try: הוא זורק.
  try {
    const session = await rotateSession(getDb(), result.userId, await readSessionToken());
    await setSessionCookie(session.token, session.expiresAt);
  } catch (e) {
    logger.error("login: creating the session failed", { error: e });
    return { error: "generic", username };
  }
  redirect(POST_LOGIN_PATH);
}

/** בחירת סיסמה מקישור חד־פעמי (הפעלה או איפוס). */
export async function activateAction(_prev: ActivateState, formData: FormData): Promise<ActivateState> {
  assertSameOrigin(await headers());
  const token = str(formData.get("token"));
  const password = str(formData.get("password"));
  const confirm = str(formData.get("confirm"));

  let setup;
  try {
    const db = getDb();
    getSessionSecret();
    const peeked = await peekToken(db, token);
    if (!peeked) return { status: "expired" };

    const issue = validatePassword(password, { username: peeked.username });
    if (issue) {
      return { error: { field: "password", code: issue === "required" ? "passwordRequired" : issue } };
    }
    if (!confirm) return { error: { field: "confirm", code: "confirmRequired" } };
    if (confirm !== password) return { error: { field: "confirm", code: "mismatch" } };

    // ה־hash (איטי במכוון) מחושב לפני הטרנזקציה; האסימון נשרף רק יחד עם שמירת הסיסמה.
    setup = await completePasswordSetup(db, { token, passwordHash: await hashPassword(password) });
  } catch (e) {
    logger.error("activation failed unexpectedly", { error: e });
    return { error: { field: "form", code: "generic" } };
  }
  if (!setup) return { status: "expired" };

  // הקישור הוכיח בעלות על החשבון: אם החשבון נעול אחרי ניסיונות כושלים, הנעילה מתאפסת, כדי שהכניסה הבאה עם הסיסמה החדשה תעבוד.
  try {
    await clearLoginLimitsForUser(getDb(), setup.userId, getSessionSecret());
  } catch (e) {
    logger.error("activation: clearing login attempts failed", { error: e });
  }

  // התחברות חדשה; התחברות קודמת של הדפדפן הזה (גם של משתמש אחר) נמחקת.
  // הסיסמה כבר נשמרה והקישור נשרף; אם יצירת ההפעלה נכשלת (תקלת מסד), מציגים שגיאה ידידותית, ואפשר להיכנס עם הסיסמה החדשה.
  try {
    const session = await rotateSession(getDb(), setup.userId, await readSessionToken());
    await setSessionCookie(session.token, session.expiresAt);
  } catch (e) {
    logger.error("activation: creating the session failed", { error: e });
    return { error: { field: "form", code: "generic" } };
  }
  redirect(POST_LOGIN_PATH);
}

/** "שכחתי סיסמה": אותה תשובה בין אם יש חשבון ובין אם אין, ובזמן מינימלי קבוע. */
export async function forgotAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const h = await headers();
  assertSameOrigin(h);
  const identifier = str(formData.get("identifier")).trim();
  if (!identifier) return { error: "required" };
  if (identifier.length > IDENTIFIER_MAX_LENGTH) return { status: "sent", identifier: "" };

  const started = Date.now();
  let state: ForgotState;
  try {
    const host = h.get("host");
    const origin = getAppOrigin() ?? (host ? `http://${host}` : undefined);
    if (!origin) throw new Error("no origin");
    const result = await requestPasswordReset(getDb(), {
      identifier,
      secret: getSessionSecret(),
      ip: clientIp(h),
      ttlMinutes: getActivationTtlMinutes(),
      sender: getMessageSender(),
      origin,
      // המשלוח רץ אחרי התשובה, כך שזמן התגובה זהה עם חשבון ובלעדיו.
      defer: after,
    });
    state =
      result.status === "rate_limited"
        ? { error: "tooMany", identifier }
        : { status: "sent", identifier, sentAt: started };
  } catch (e) {
    logger.error("forgot password failed unexpectedly", { error: e });
    state = { error: "generic", identifier };
  }
  const wait = FORGOT_MIN_RESPONSE_MS - (Date.now() - started);
  if (wait > 0) await sleep(wait);
  return state;
}

/**
 * יציאה: מוחק את שורת ההפעלה ואת העוגייה. אם הטופס שלח את כתובת מנוי ההתראות של המכשיר (LogoutForm, אחרי
 * שביטל אותו בדפדפן), גם השורה שלו נמחקת, רק אם היא של המשתמש שיוצא. כך טלפון משותף לא ממשיך לקבל את
 * התזכורות של מי שיצא. כשל במחיקה הזאת לא עוצר את היציאה.
 */
export async function logoutAction(formData?: FormData): Promise<void> {
  assertSameOrigin(await headers());
  const token = await readSessionToken();
  if (token) {
    const endpoint = formData?.get("push_endpoint");
    if (typeof endpoint === "string" && endpoint) {
      try {
        await removeSubscriptionForSession(getDb(), token, endpoint);
      } catch (e) {
        logger.error("logout: push subscription cleanup failed", { error: e });
      }
    }
    await deleteSession(getDb(), token);
  }
  await clearSessionCookie();
  redirect("/login");
}
