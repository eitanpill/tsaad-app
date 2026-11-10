import "server-only";
import { getConfig } from "@/config";
import type { LiveDay, LiveInput } from "./model";

/** הקישור והשעה של כל מפגש, מהסביבה (LIVE_URL_DAY7/14, LIVE_TIME_DAY7/14). לא מוגדר = undefined; אין ערך מומצא. */
export function getLiveInputs(env = getConfig().env): Record<LiveDay, LiveInput> {
  return {
    7: { time: env.LIVE_TIME_DAY7, url: env.LIVE_URL_DAY7 },
    14: { time: env.LIVE_TIME_DAY14, url: env.LIVE_URL_DAY14 },
  };
}
