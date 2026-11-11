export type ErrorKey =
  | "generic"
  | "forbidden"
  | "tooMany"
  | "invalidName"
  | "invalidContact"
  | "notFound"
  | "self"
  | "disabledUser"
  | "confirmMismatch"
  | "invalidDay";

/** מצב של טופס ניהול. קישור חד־פעמי חוזר רק כאן (בזיכרון הדפדפן), ולא נשמר בשום מקום. */
export type AdminState =
  | { status: "idle" }
  | { status: "error"; error: ErrorKey }
  | { status: "done"; message: string }
  | { status: "link"; link: string; purpose: "activate" | "reset"; name: string; username: string; until: string };

export const IDLE: AdminState = { status: "idle" };
