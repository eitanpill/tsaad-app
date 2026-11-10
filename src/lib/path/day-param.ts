/**
 * פרמטר היום בכתובת /day/[n]: "5" בלבד (1 עד 14, בלי אפסים מובילים, סימנים, נקודה עשרונית או רווחים).
 * מודול בלי תלויות: משמש גם את proxy.ts (404 אמיתי לפני הרינדור) וגם את הדף עצמו.
 */
const DAY_PARAM = /^(?:[1-9]|1[0-4])$/;

export function parseDayParam(raw: string): number | null {
  return DAY_PARAM.test(raw) ? Number(raw) : null;
}

/**
 * true כשהכתובת היא /day/<משהו> והמשהו אינו יום תקין (אחרי פענוח %XX, כמו שהדף מקבל אותו).
 * כתובות עמוקות יותר (/day/3/x) ממילא אינן נתיב, ו־Next מחזיר עליהן 404 בעצמו.
 */
export function isInvalidDayPath(pathname: string): boolean {
  const m = /^\/day\/([^/]+)\/?$/.exec(pathname);
  if (!m) return false;
  let seg: string;
  try {
    seg = decodeURIComponent(m[1]);
  } catch {
    return true;
  }
  return parseDayParam(seg) === null;
}
