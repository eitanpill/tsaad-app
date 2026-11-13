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
  /** בחירת שעת התזכורת של המשתתף/ת: דקות מחצות, בצעדים של 30, מ־05:30 עד 21:00 (שעון מקומי). */
  timeMinMinutes: 330,
  timeMaxMinutes: 1260,
  timeStepMinutes: 30,
  /** ברירת המחדל לכולם (07:30); זהה ל־DEFAULT של users.reminder_time ב־DB. */
  timeDefaultMinutes: 450,
  /** תזכורת שלא יצאה בזמן ננסה שוב עד שעת הבחירה + 4.5 שעות, ולא אחרי 23:59 של אותו יום. */
  retryWindowMinutes: 270,
  latestCutoffMinutes: 23 * 60 + 59,
  /** כמה שליחות במקביל בריצה אחת. */
  sendConcurrency: 10,
  /** כמה משתמשים נתפסים (נרשמים ב־reminder_log) בכל סבב; משתמשים שלא נתפסו יטופלו בריצה הבאה. */
  claimBatchSize: 200,
  /** אחרי כמה זמן (מ"ש) ריצה מפסיקה לתפוס סבבים חדשים, כדי לא להיחתך באמצע סבב. */
  runBudgetMs: 60_000,
  /** מקסימום מנויים (החדשים ביותר) שנשלח אליהם לכל משתמש. */
  maxSubscriptionsPerUser: 5,
  /** תקרה כוללת לשליחה אחת (ה־timeout של web-push הוא על שקט בשקע בלבד). */
  sendDeadlineMs: 15_000,
  /** כתובת שהתראה פותחת (יחסית, באותו origin). */
  openPath: "/today",
});

/**
 * מפגשי הלייב (שלב 9). הקישור נשלח ללקוח רק בתוך החלון: מ־linkOpensBeforeMinutes לפני תחילת המפגש
 * ועד linkOpenAfterStartMinutes אחריה (אורך משוער + גרייס). אורך המפגש בפועל לא נקבע: calendarDurationMinutes
 * משמש רק לסוף האירוע בקובץ היומן. אלה קבועים טכניים, לא התחייבות לציבור.
 */
export const LIVE = Object.freeze({
  /** הקישור נפתח שעה לפני המפגש (כמו ב־copy.live.linkOpensLater). */
  linkOpensBeforeMinutes: 60,
  /** הקישור נשאר גלוי עד 120 דקות אחרי תחילת המפגש (מפגש של כ־60 דקות לפי פית, 2026-11-10, + גרייס 60). */
  linkOpenAfterStartMinutes: 120,
  /** משך האירוע בקובץ היומן. */
  calendarDurationMinutes: 60,
});

/**
 * הצעת יום 14 (שלב 10). סוף הלייב של יום 14 = תחילתו + calendarDurationMinutes (מפגש של כ־60 דקות לפי פית, 2026-11-10).
 * אורך חלון ההצעה (OFFER_WINDOW_HOURS) ותחילת הלייב (LIVE_TIME_DAY14) מגיעים מהתצורה; בלי אחד מהם ההצעה לא נפתחת.
 */
export const OFFER = Object.freeze({
  liveEndsAfterStartMinutes: LIVE.calendarDurationMinutes,
});

/**
 * תוויות מעקב לקישורי ההצעות. אלה שמות טכניים (לא ערכים עסקיים). ה־utm_campaign של כל הצעה מגיע מהתצורה
 * (OFFER_UTM_SESSION / OFFER_UTM_BUNDLE / OFFER_UTM_YESODOT); כשלא הוגדר, הפרמטר לא נוסף.
 */
export const UTM = Object.freeze({
  source: "tsaad_app",
  medium: "app",
});

/** תאריכים בדפים המשפטיים (טיוטה, ממתינה לבדיקה משפטית). תאריך הבדיקה האחרונה של הנגישות הוא תאריך הסקירה האחרון של שלב 10. */
export const LEGAL = Object.freeze({
  accessibilityLastChecked: "2026-11-10",
  draftDate: "2026-11-10",
});

/** התראות דחיפה (שלב 9). תקרת המנויים למשתמש (מכשירים) היא REMINDERS.maxSubscriptionsPerUser: המנוי הוותיק ביותר נמחק בהוספת חדש מעבר לה. */
export const PUSH = Object.freeze({
  /** גודל גוף בקשה מרבי, בבתים (מנוי תקין הוא פחות מ־1KB). */
  maxBodyBytes: 4096,
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

/** ה־webhook של GHL (שלב 9א). ערכים טכניים, לא עסקיים. */
export const WEBHOOK = Object.freeze({
  /** גודל גוף מרבי, בבתים (גוף תקין הוא פחות מ־2KB). */
  maxBodyBytes: 16 * 1024,
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

/**
 * GHL API v2 (שלב D1). הכתובת קבועה בקוד בכוונה (לא ממשתנה סביבה), כדי שהטוקן לא יישלח לכתובת אחרת.
 * את הצורה של הקריאות צריך לאמת בקריאה החיה הראשונה (ראו docs/GHL_SETUP.md).
 */
export const GHL = Object.freeze({
  baseUrl: "https://services.leadconnectorhq.com",
  apiVersion: "2021-07-28",
  /** תקרה לכל קריאה אחת, במילישניות. */
  timeoutMs: 10_000,
  /** כמה שורות outbox של GHL בריצה אחת. */
  batchSize: 50,
  /**
   * כמה שורות נתפסות בכל סבב. קטן בכוונה: שורה היא עד 3 קריאות של timeoutMs, וסבב חייב להסתיים לפני שה־lease
   * (SYNC.leaseSeconds) פג, אחרת ריצה אחרת עלולה לתפוס את אותה שורה ולשלוח פעמיים.
   */
  claimChunk: 5,
  /** אחרי כמה זמן (מ"ש) ריצה מפסיקה לתפוס סבבים חדשים. */
  runBudgetMs: 60_000,
  /** מקסימום תגובה שנקרא (בתים). */
  maxResponseBytes: 64 * 1024,
});
