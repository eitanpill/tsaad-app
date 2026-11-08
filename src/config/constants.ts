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
