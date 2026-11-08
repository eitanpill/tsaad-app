import "server-only";
import { getConfig } from "@/config";
import { makeSchedule, type Schedule } from "@/lib/days";

/**
 * לוח האתגר מהתצורה. START_DATE עוד לא נקבע (אין תאריך מומצא), ולכן null פירושו "עוד לא התחיל".
 */
export function getSchedule(): Schedule | null {
  const cfg = getConfig();
  if (!cfg.startDate) return null;
  return makeSchedule(cfg.startDate, { timeZone: cfg.timeZone, unlockTime: cfg.unlockTime });
}
