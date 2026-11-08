/**
 * קבועי האתגר. אין כאן סודות ואין תלות בסביבה, ולכן מותר לייבא גם בקוד לקוח.
 */
export const CHALLENGE = Object.freeze({
  /** מספר ימי האתגר. */
  totalDays: 14,
  /** מספר הימים הנדרש להשלמת האתגר. */
  daysToComplete: 12,
  /** ימים עם מפגש לייב. */
  liveDays: Object.freeze([7, 14] as const),
  /** שעת פתיחת יום חדש, שעון מקומי. */
  unlockTime: "05:00",
  /** שעת תזכורת, שעון מקומי. */
  reminderTime: "07:30",
  /** אזור הזמן. */
  timeZone: "Asia/Jerusalem",
});

export const DEFAULT_UNLOCK_TIME = CHALLENGE.unlockTime;
export const DEFAULT_REMINDER_TIME = CHALLENGE.reminderTime;
export const DEFAULT_TZ_NAME = CHALLENGE.timeZone;

/**
 * ברירות מחדל טכניות לשכבת הרקע (שלב 6). אלה לא ערכים עסקיים, וניתן לשנות אותם בקוד בלבד.
 */
export const REMINDERS = Object.freeze({
  /** אחרי השעה הזאת (שעון מקומי) כבר לא שולחים תזכורת של אותו יום. */
  cutoffTime: "12:00",
  /** כמה שליחות במקביל בריצה אחת. */
  sendConcurrency: 10,
  /** כתובת שהתראה פותחת (יחסית, באותו origin). */
  openPath: "/today",
});

export const SYNC = Object.freeze({
  /** מספר הניסיונות המרבי לפני שהשורה הופכת ל־dead. */
  maxAttempts: 8,
  /** השהיה בסיסית לניסיון חוזר ראשון, בשניות. מוכפלת פי 2 בכל ניסיון. */
  backoffBaseSeconds: 60,
  /** תקרת ההשהיה, בשניות (6 שעות). */
  backoffMaxSeconds: 6 * 60 * 60,
  /** ג'יטר: ההשהיה נבחרת באקראי בטווח [1-jitter, 1] מההשהיה המחושבת. */
  jitter: 0.25,
  /** כמה זמן שורה שנתפסה "שמורה" לעובד לפני שעובד אחר רשאי לקחת אותה (קריסה באמצע). */
  leaseSeconds: 5 * 60,
  /** כמה שורות בריצה אחת. */
  batchSize: 50,
  /** אורך מרבי של last_error. */
  maxErrorLength: 300,
});

/** שמירת נתונים (ימים). */
export const RETENTION = Object.freeze({
  /** מזהי webhook: מספיק לחלון ה־retry של השולח. */
  webhookEventsDays: 30,
  /** שורות outbox שנשלחו. */
  syncSentDays: 14,
  /** שורות outbox שנכשלו סופית (dead), נשמרות לבדיקה ידנית. */
  syncDeadDays: 90,
  /** יומן תזכורות; רק התאריך של היום חשוב למניעת כפילות. */
  reminderLogDays: 90,
});
