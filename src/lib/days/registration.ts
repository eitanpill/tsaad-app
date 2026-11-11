import { CHALLENGE } from "@/config/constants";
import { unlockInstant, type Schedule } from "./schedule";

/** ההרשמה נסגרת בסוף יום 2 של האתגר (שעון ישראל), כלומר ברגע שיום 3 נפתח (05:00). החלטת הבעלים. */
export const REGISTRATION_LAST_DAY = 2;

/**
 * האם ההרשמה למחזור נסגרה ברגע הנתון. בלי לוח (START_DATE לא הוגדר) ההרשמה פתוחה.
 * תשלום שכבר בוצע לא נחסם: ה־webhook ממשיך ליצור חשבונות (ראו handler.ts).
 */
export function registrationClosed(now: Date, schedule: Schedule | null): boolean {
  if (!schedule) return false;
  const lastDay = Math.min(REGISTRATION_LAST_DAY, CHALLENGE.totalDays - 1);
  return now.getTime() >= unlockInstant(lastDay + 1, schedule).getTime();
}
