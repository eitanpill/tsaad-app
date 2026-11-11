import "server-only";
import { getConfig } from "@/config";

/** שעת הפתיחה והתזכורת מהתצורה (UNLOCK_HOUR, REMINDER_TIME), למילוי {unlockTime} ו־{reminderTime} בטקסטים. */
export function timeTokens(): { unlockTime: string; reminderTime: string } {
  const c = getConfig();
  return { unlockTime: c.unlockTime, reminderTime: c.reminderTime };
}
