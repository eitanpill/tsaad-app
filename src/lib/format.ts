/** ממלא משתנים בסוגריים מסולסלים, למשל "{seconds}", בטקסטים מ־copy.he.ts. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (Object.hasOwn(values, k) ? String(values[k]) : m));
}

const HE_DATE = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", timeZone: "UTC" });
const HE_DATE_WD = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** תאריך מקומי "YYYY-MM-DD" בעברית: "30 בנובמבר", או עם יום בשבוע "יום שני, 30 בנובמבר". */
export function formatHeDate(date: string, opts: { weekday?: boolean } = {}): string {
  return (opts.weekday ? HE_DATE_WD : HE_DATE).format(new Date(`${date}T00:00:00Z`));
}

/** "[START_DATE]" מתמלא בתאריך מהתצורה; בלי תאריך מוגדר, המציין נשאר כלשונו (אין תאריך מומצא). */
export function withStartDate(text: string, startDate: string | undefined): string {
  if (!startDate) return text;
  return text.replaceAll("[START_DATE]", HE_DATE.format(new Date(`${startDate}T00:00:00Z`)));
}
