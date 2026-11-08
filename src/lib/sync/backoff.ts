import { SYNC } from "@/config/constants";

/**
 * השהיה (בשניות) לפני ניסיון מספר attempts+1, אחרי attempts ניסיונות שנכשלו (attempts >= 1):
 * base * 2^(attempts-1), עד התקרה, ואז ג'יטר כלפי מטה כדי שהרצות לא ייצמדו.
 * @param random פונקציה בטווח [0,1), ניתנת להזרקה לבדיקות.
 */
export function backoffSeconds(
  attempts: number,
  random: () => number = Math.random,
  cfg: Pick<typeof SYNC, "backoffBaseSeconds" | "backoffMaxSeconds" | "jitter"> = SYNC,
): number {
  const n = Math.max(1, Math.floor(attempts));
  const exp = Math.min(cfg.backoffMaxSeconds, cfg.backoffBaseSeconds * 2 ** Math.min(n - 1, 30));
  const factor = 1 - cfg.jitter * random();
  return Math.max(1, Math.round(exp * factor));
}
