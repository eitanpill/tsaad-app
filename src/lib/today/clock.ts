import "server-only";
import { headers } from "next/headers";
import { TEST_CLOCK_HEADER, resolveNow } from "./test-clock";

/**
 * השעון של השרת. כל החלטה על יום, נעילה וסימון נעשית לפיו, ולא לפי שעון הלקוח.
 * (שעון הבדיקות פעיל רק לפי ההגנה ב־test-clock.ts.)
 * חייב להיקרא בזמן בקשה (קורא כותרות), לכן הוא גם מוציא את הרכיב מהרינדור הסטטי.
 */
export async function serverNow(): Promise<Date> {
  const h = await headers();
  return resolveNow(process.env, h.get(TEST_CLOCK_HEADER), new Date());
}
