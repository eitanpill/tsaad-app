import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * סכימת מסד הנתונים. כל טבלה עם מידע אישי מצביעה ל־users עם ON DELETE CASCADE,
 * כך שמחיקת חשבון מוחקת את כל המידע האישי עליו.
 * אסימונים (הפעלה, התחברות) נשמרים כ־hash בלבד.
 */
const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const ts = (name: string) => timestamp(name, { withTimezone: true });
const userRef = (name = "user_id") =>
  uuid(name)
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const users = pgTable(
  "users",
  {
    id: id(),
    /** תמיד באותיות קטנות (נאכף ב־CHECK); ייחודי. */
    username: text("username").notNull().unique(),
    displayName: text("display_name").notNull(),
    /** יכול להיות ריק: נרשמים דרך GHL עם טלפון בלבד. לפחות אחד מהאימייל והטלפון נשמר בהרשמה. */
    email: text("email"),
    phone: text("phone"),
    ghlContactId: text("ghl_contact_id").unique(),
    /** null עד שהמשתתף/ת מפעיל/ה את החשבון דרך קישור חד־פעמי. */
    passwordHash: text("password_hash"),
    createdAt: ts("created_at").notNull().defaultNow(),
    activatedAt: ts("activated_at"),
  },
  (t) => [
    check("users_username_lower", sql`${t.username} = lower(${t.username})`),
    index("users_email_idx").on(sql`lower(${t.email})`),
  ],
);

export const ACTIVATION_PURPOSES = ["activate", "reset"] as const;

export const activationTokens = pgTable(
  "activation_tokens",
  {
    id: id(),
    userId: userRef(),
    tokenHash: text("token_hash").notNull().unique(),
    purpose: text("purpose", { enum: ACTIVATION_PURPOSES }).notNull(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("activation_tokens_purpose", sql`${t.purpose} in ('activate','reset')`),
    index("activation_tokens_user_idx").on(t.userId),
    index("activation_tokens_expires_idx").on(t.expiresAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: userRef(),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: ts("created_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  },
  (t) => [
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
  ],
);

export const ATTEMPT_KINDS = ["login", "forgot", "toggle", "push", "webhook", "account"] as const;

/**
 * ניסיונות להגבלת קצב: התחברות כושלת, בקשת "שכחתי סיסמה", סימון פעולה (toggle, לפי משתמש), כשל אימות / חידוש קישור ב־webhook של GHL, או ניסיון מחיקת חשבון (account, לפי משתמש).
 * המזהים הם HMAC (במפתח SESSION_SECRET), לא שם משתמש או IP גולמיים.
 */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: id(),
    kind: text("kind", { enum: ATTEMPT_KINDS }).notNull().default("login"),
    identifierHash: text("identifier_hash").notNull(),
    ipHash: text("ip_hash"),
    attemptedAt: ts("attempted_at").notNull().defaultNow(),
  },
  (t) => [
    check("login_attempts_kind", sql`${t.kind} in ('login','forgot','toggle','push','webhook','account')`),
    index("login_attempts_identifier_idx").on(t.kind, t.identifierHash, t.attemptedAt),
    index("login_attempts_ip_idx").on(t.kind, t.ipHash, t.attemptedAt),
  ],
);

/** מזהי אירועי webhook שכבר טופלו (אידמפוטנטיות). אין כאן מידע אישי. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    eventId: text("event_id").notNull().unique(),
    source: text("source").notNull().default("ghl"),
    receivedAt: ts("received_at").notNull().defaultNow(),
  },
  (t) => [index("webhook_events_received_idx").on(t.receivedAt)],
);

export const COMPLETION_ACTIONS = ["habit", "move", "meditate", "live"] as const;

export const actionCompletions = pgTable(
  "action_completions",
  {
    id: id(),
    userId: userRef(),
    day: smallint("day").notNull(),
    action: text("action", { enum: COMPLETION_ACTIONS }).notNull(),
    completedAt: ts("completed_at").notNull().defaultNow(),
  },
  (t) => [
    unique("action_completions_user_day_action").on(t.userId, t.day, t.action),
    check("action_completions_day", sql`${t.day} between 1 and 14`),
    check(
      "action_completions_action",
      sql`${t.action} in ('habit','move','meditate','live')`,
    ),
    // הגנה בשכבת המסד: לייב רק בימי לייב, תנועה/מדיטציה רק בימים רגילים.
    check(
      "action_completions_action_day",
      sql`${t.action} = 'habit' or (${t.action} = 'live') = (${t.day} in (7, 14))`,
    ),
    index("action_completions_user_day_idx").on(t.userId, t.day),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    userId: userRef(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

/** pending: נקבע לפני השליחה (מונע כפל); נשאר כך אם התהליך קרס באמצע. */
export const REMINDER_STATUSES = ["pending", "dry_run", "sent", "failed"] as const;

export const reminderLog = pgTable(
  "reminder_log",
  {
    id: id(),
    userId: userRef(),
    /** התאריך המקומי (Asia/Jerusalem) שאליו שייכת התזכורת. */
    date: date("date", { mode: "string" }).notNull(),
    status: text("status", { enum: REMINDER_STATUSES }).notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("reminder_log_user_date").on(t.userId, t.date),
    check("reminder_log_status", sql`${t.status} in ('pending','dry_run','sent','failed')`),
  ],
);

/**
 * pending: ממתין (או שמור לעובד). failed: הניסיון האחרון נכשל, ינוסה שוב.
 * sent: נשלח. dead: חרג ממספר הניסיונות, דורש בדיקה ידנית.
 */
export const SYNC_STATUSES = ["pending", "sent", "failed", "dead"] as const;

export const syncOutbox = pgTable(
  "sync_outbox",
  {
    id: id(),
    userId: userRef(),
    kind: text("kind").notNull(),
    /** מפתח ייחודי למניעת כפילויות; null מותר. */
    dedupeKey: text("dedupe_key"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    status: text("status", { enum: SYNC_STATUSES }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: ts("next_attempt_at").notNull().defaultNow(),
    lastError: text("last_error"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("sync_outbox_status", sql`${t.status} in ('pending','sent','failed','dead')`),
    uniqueIndex("sync_outbox_dedupe_idx").on(t.dedupeKey),
    index("sync_outbox_due_idx").on(t.status, t.nextAttemptAt),
    index("sync_outbox_user_idx").on(t.userId),
  ],
);
