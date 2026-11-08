/**
 * 14 ימי האתגר "צעד קטן ביום", כפי שסוכמו במפרט. הכותרות מועתקות כלשונן.
 * הסדר בכל יום: הרגל, תנועה, מדיטציה. אלה שמות ותקצירי תוכן, לא הנחיות ולא סרטונים.
 * בימים 7 ו־14 הלייב מחליף את רכיבי התנועה והמדיטציה (הכותרת "לייב" בשניהם).
 *
 * הבדלים מול עמוד המעקב הישן (לתיעוד; התוכן כאן לפי המפרט, חוץ מהמצוין):
 * 1. הניסוחים שונים כמעט בכל שורה. דוגמאות: יום 1 "מים חמימים עם לימון" מול
 *    "כוס מים חמימים עם לימון כשקמים"; יום 4 "שבע דקות אור שמש" מול
 *    "7 דקות אמבטיית שמש"; יום 10 "פתיחת בית החזה" מול "פתיחת לב"; יום 13
 *    "יין לפני השינה" מול "יין יוגה לפני השינה". כאן הכול לפי המפרט.
 * 2. יום 13, מדיטציה: הנוסח המאושר הוא "7 דקות מודרכות: לבחור הרגלים מיטיבים"
 *    (אושר בסקירה של 2026-11-08, במקום הנוסח מהמפרט).
 * 3. עמוד המעקב הישן ספר יום רק כששלוש הפעולות סומנו, והמפרט קובע שפעולה
 *    אחת מספיקה. כאן אין לוגיקה, רק תוכן.
 * 4. (הוחלט 2026-11-08: הלייב נספר כשני צעדים בכוס.) בימים 7 ו־14 בעמוד הישן הכותרת היא "תנועה בלייב עם אביטל" ו"מדיטציה
 *    בלייב עם אביטל". במפרט רק "לייב". איך סימון הנוכחות בלייב מתמפה לשתי
 *    הפעולות (אחת, שתיים או סימון נפרד)? לא הוחלט.
 */

export type ActionType = "habit" | "move" | "meditate";

export type DayAction = {
  readonly type: ActionType;
  readonly title: string;
};

export type DayContent = {
  readonly day: number;
  /** יום עם מפגש לייב (7 ו־14). */
  readonly live: boolean;
  readonly habit: DayAction;
  readonly movement: DayAction;
  readonly meditation: DayAction;
};

export const ACTION_TYPES = ["habit", "move", "meditate"] as const;

export const DAYS: readonly DayContent[] = [
  {
    day: 1,
    live: false,
    habit: { type: "habit", title: "מים חמימים עם לימון" },
    movement: { type: "move", title: "מתיחות עדינות בעמידה" },
    meditation: { type: "meditate", title: "דקת נשימה עם הכוס" },
  },
  {
    day: 2,
    live: false,
    habit: { type: "habit", title: "חמש נשימות במיטה" },
    movement: { type: "move", title: "חימום עמוד השדרה ושיווי משקל" },
    meditation: { type: "meditate", title: "סריקת גוף" },
  },
  {
    day: 3,
    live: false,
    habit: { type: "habit", title: "בלי טלפון בחצי השעה הראשונה בבוקר" },
    movement: { type: "move", title: "כפיפה קדימה ופתיחת חזה" },
    meditation: { type: "meditate", title: "תחושות הגוף" },
  },
  {
    day: 4,
    live: false,
    habit: { type: "habit", title: "שבע דקות אור שמש" },
    movement: { type: "move", title: "פלג גוף תחתון" },
    meditation: { type: "meditate", title: "שלושה צלילים" },
  },
  {
    day: 5,
    live: false,
    habit: { type: "habit", title: "לקום בכל שעה" },
    movement: { type: "move", title: "פלג גוף עליון" },
    meditation: { type: "meditate", title: "הכרת תודה" },
  },
  {
    day: 6,
    live: false,
    habit: { type: "habit", title: "בדיקת יציבה" },
    movement: { type: "move", title: "תנועה דינמית" },
    meditation: { type: "meditate", title: "נשימה להארכת הגב" },
  },
  {
    day: 7,
    live: true,
    habit: { type: "habit", title: "ארוחה בלי מסכים" },
    movement: { type: "move", title: "לייב" },
    meditation: { type: "meditate", title: "לייב" },
  },
  {
    day: 8,
    live: false,
    habit: { type: "habit", title: "שלושה ביסים בתשומת לב" },
    movement: { type: "move", title: "ברכת השמש" },
    meditation: { type: "meditate", title: "הליכה מודעת" },
  },
  {
    day: 9,
    live: false,
    habit: { type: "habit", title: "מים לפני הארוחות" },
    movement: { type: "move", title: "תנוחות לוחם" },
    meditation: { type: "meditate", title: "חמש דקות על אי־פגיעה" },
  },
  {
    day: 10,
    live: false,
    habit: { type: "habit", title: "שלוש תודות" },
    movement: { type: "move", title: "פתיחת בית החזה" },
    meditation: { type: "meditate", title: "חמש דקות חמלה" },
  },
  {
    day: 11,
    live: false,
    habit: { type: "habit", title: "טעינת הטלפון מחוץ לחדר השינה" },
    movement: { type: "move", title: "תנוחות הפוכות עדינות" },
    meditation: { type: "meditate", title: "שאיפה בספירה עד 4 ונשיפה עד 6" },
  },
  {
    day: 12,
    live: false,
    habit: { type: "habit", title: "בלי מסכים לפחות חצי שעה לפני השינה" },
    movement: { type: "move", title: "שלוש תנוחות ערב" },
    meditation: { type: "meditate", title: "שחרור הגוף" },
  },
  {
    day: 13,
    live: false,
    habit: { type: "habit", title: "שעת שינה קבועה" },
    movement: { type: "move", title: "יין לפני השינה" },
    meditation: { type: "meditate", title: "7 דקות מודרכות: לבחור הרגלים מיטיבים" },
  },
  {
    day: 14,
    live: true,
    habit: { type: "habit", title: "בחירת הרגלים להמשך" },
    movement: { type: "move", title: "לייב" },
    meditation: { type: "meditate", title: "לייב" },
  },
];
