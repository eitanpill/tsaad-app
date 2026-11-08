import type { copy } from "@/content/copy.he";

export type LoginState = {
  error?: "usernameRequired" | "passwordRequired" | "invalid" | "tooMany" | "generic";
  username?: string;
};

export type ActivateErrorCode = keyof typeof copy.activate.errors;

export type ActivateState = {
  /** "expired": הקישור כבר לא תקף; מציגים את מצב הקישור שפג. */
  status?: "expired";
  error?: { field: "password" | "confirm" | "form"; code: ActivateErrorCode };
};

export type ForgotState = {
  status?: "sent";
  /** מזהה השליחה (זמן), כדי שהספירה לאחור תתאפס בכל שליחה. */
  sentAt?: number;
  error?: "required" | "tooMany" | "generic";
  identifier?: string;
};
