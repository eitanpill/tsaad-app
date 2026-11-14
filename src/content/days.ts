/**
 * 14 ימי האתגר "צעד קטן ביום". התוכן לפי קובץ התוכן של פיט מ־2026-11-10 (pit-content.docx),
 * והכותרות מועתקות כלשונן. הסדר בכל יום: הרגל, תנועה, מדיטציה. אלה שמות ותקצירי תוכן, לא הנחיות ולא סרטונים.
 * בימים 7 ו־14 הלייב מחליף את רכיבי התנועה והמדיטציה (הכותרת "לייב" בשניהם).
 * לכל יום יש גם "opening": משפט הפתיחה שנאמר בצילום, כלשונו בקובץ.
 * יוצא דופן: יום 13, מדיטציה. הכותרת הקצרה המאושרת (סקירה 2026-11-08) נשארת כותרת,
 * והנוסח הארוך מהקובץ נמצא ב־detail ומוצג כשורה משנית מתחתיה.
 */

export type ActionType = "habit" | "move" | "meditate";

export type DayAction = {
  readonly type: ActionType;
  readonly title: string;
  /** נוסח ארוך יותר, אופציונלי; מוצג כשורה משנית מתחת לכותרת. */
  readonly detail?: string;
};

export type DayContent = {
  readonly day: number;
  /** יום עם מפגש לייב (7 ו־14). */
  readonly live: boolean;
  /** משפט הפתיחה בצילום, כלשונו (בלי מרכאות החיצוניות). */
  readonly opening: string;
  /**
   * מזהה סרטון התרגול ב־Bunny Stream (רק האותיות, הספרות, "_" ו־"-" של המזהה). אופציונלי: בלי מזהה אין סרטון ליום.
   * המשתנה BUNNY_VIDEO_IDS דורס אותו לאותו יום כשהוא מוגדר. קובץ זה נשאר בשרת: המזהה לא נשלח לדפדפן, והסרטון נחתם בבקשה (ראו docs/CONTENT.md).
   */
  readonly videoId?: string;
  readonly habit: DayAction;
  readonly movement: DayAction;
  readonly meditation: DayAction;
};

export const ACTION_TYPES = ["habit", "move", "meditate"] as const;

export const DAYS: readonly DayContent[] = [
  {
    day: 1,
    live: false,
    opening: "יום 1. ההרגל של היום: כוס מים חמימים עם לימון כשקמים. קחו נשימה אחת איתי, ומתחילים.",
    habit: { type: "habit", title: "כוס מים חמימים עם לימון כשקמים" },
    movement: { type: "move", title: "מתיחת בוקר עדינה בעמידה" },
    meditation: { type: "meditate", title: "דקה של נשימה עם כוס המים" },
  },
  {
    day: 2,
    live: false,
    opening: "יום 2. ההרגל של היום: חמש נשימות עמוקות במיטה. קחו נשימה אחת איתי, ומתחילים.",
    habit: { type: "habit", title: "לסדר את המיטה מיד כשקמים" },
    movement: { type: "move", title: "חימום עמוד השדרה ושיווי משקל" },
    meditation: { type: "meditate", title: "סריקת גוף קצרה, מהראש לרגליים" },
  },
  {
    day: 3,
    live: false,
    opening: "יום 3. ההרגל של היום: חצי שעה בלי טלפון מרגע שקמים. קחו נשימה אחת איתי, ומתחילים.",
    habit: { type: "habit", title: "חצי שעה בלי טלפון מרגע ההתעוררות" },
    movement: { type: "move", title: "כפיפה קדימה רכה ופתיחת חזה" },
    meditation: { type: "meditate", title: "לשים לב לתחושות בגוף" },
  },
  {
    day: 4,
    live: false,
    opening: "יום 4. ההרגל של היום: שבע דקות של אמבטיית שמש. קחו נשימה אחת איתי, ומתחילים.",
    habit: { type: "habit", title: "7 דקות אמבטיית שמש" },
    movement: { type: "move", title: "חיזוק פלג גוף תחתון" },
    meditation: { type: "meditate", title: "להקשיב ל־3 צלילים סביבכם" },
  },
  {
    day: 5,
    live: false,
    opening: "יום 5. ההרגל של היום: לקום מהכיסא פעם בשעה. קחו נשימה אחת איתי, ומתחילים.",
    habit: { type: "habit", title: "מדרגות במקום מעלית, והליכה במקום נסיעה קצרה" },
    movement: { type: "move", title: "חיזוק פלג גוף עליון" },
    meditation: { type: "meditate", title: "הודיה" },
  },
  {
    day: 6,
    live: false,
    opening: "יום 6. ההרגל של היום: בדיקת יציבה. קחו נשימה אחת איתי, ומתחילים.",
    habit: { type: "habit", title: "הודעה אחת טובה לאדם שאוהבים" },
    movement: { type: "move", title: "תנועה דינמית להזרמת הדם" },
    meditation: { type: "meditate", title: "נשימה שמאריכה את הגב" },
  },
  {
    day: 7,
    live: true,
    opening: "יום 7. ההרגל של היום: ארוחה אחת בלי מסכים. קחו נשימה אחת איתי, ומתחילים.",
    habit: { type: "habit", title: "ארוחה אחת בלי מסכים" },
    movement: { type: "move", title: "לייב" },
    meditation: { type: "meditate", title: "לייב" },
  },
  {
    day: 8,
    live: false,
    opening: "יום 8. ההרגל של היום: שלושת הביסים הראשונים לאט. קחו נשימה אחת איתי, ומתחילים.",
    habit: { type: "habit", title: "אכילה קשובה, 3 ביסים ראשונים לאט" },
    movement: { type: "move", title: "ברכת השמש" },
    meditation: { type: "meditate", title: "הליכה מודעת" },
  },
  {
    day: 9,
    live: false,
    opening: "יום 9. ההרגל של היום: כוס מים לפני הארוחות. קחו נשימה אחת איתי, ומתחילים.",
    habit: { type: "habit", title: "כוס מים לפני כל ארוחה, ולפחות 2 ליטר ביום" },
    movement: { type: "move", title: "תנוחות הלוחם" },
    meditation: { type: "meditate", title: "5 דקות מודרכות על אי־פגיעה" },
  },
  {
    day: 10,
    live: false,
    opening: "יום 10. ההרגל של היום: שלוש הודיות. קחו נשימה אחת איתי, ומתחילים.",
    habit: { type: "habit", title: "3 תודות" },
    movement: { type: "move", title: "פתיחת לב, ידיים לאחור וחזה קדימה" },
    meditation: { type: "meditate", title: "5 דקות מודרכות בנושא חמלה" },
  },
  {
    day: 11,
    live: false,
    opening: "יום 11. ההרגל של היום: הטלפון נטען מחוץ לחדר השינה. קחו נשימה אחת איתי, ומתחילים.",
    habit: { type: "habit", title: "הטלפון נטען מחוץ לחדר" },
    movement: { type: "move", title: "תנוחות הפוכות עדינות" },
    meditation: { type: "meditate", title: "נשימה: שאיפה ב־4, נשיפה ב־6 לפני השינה" },
  },
  {
    day: 12,
    live: false,
    opening: "יום 12. ההרגל של היום: חצי שעה בלי מסכים לפני השינה. קחו נשימה אחת איתי, ומתחילים.",
    habit: { type: "habit", title: "חצי שעה בלי מסכים לפני השינה" },
    movement: { type: "move", title: "רצף ערב קצר של 3 תנוחות" },
    meditation: { type: "meditate", title: "שחרור הגוף, איבר אחרי איבר" },
  },
  {
    day: 13,
    live: false,
    opening: "יום 13. ההרגל של היום: שעת שינה קבועה. קחו נשימה אחת איתי, ומתחילים.",
    habit: { type: "habit", title: "שעת שינה קבועה" },
    movement: { type: "move", title: "יין יוגה לפני השינה" },
    meditation: { type: "meditate", title: "7 דקות מודרכות: לבחור הרגלים מיטיבים", detail: "7 דקות מודרכות על הרגלים: מה עומד מאחוריהם ולמה חשוב לבחור בהרגלים מיטיבים" },
  },
  {
    day: 14,
    live: true,
    opening: "יום 14. ההרגל של היום: לבחור את ההרגלים שממשיכים איתם. קחו נשימה אחת איתי, ומתחילים.",
    habit: { type: "habit", title: "לבחור את ההרגלים שממשיכים איתם" },
    movement: { type: "move", title: "לייב" },
    meditation: { type: "meditate", title: "לייב" },
  },
];
