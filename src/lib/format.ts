/** ממלא משתנים בסוגריים מסולסלים, למשל "{seconds}", בטקסטים מ־copy.he.ts. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (Object.hasOwn(values, k) ? String(values[k]) : m));
}

const HE_DATE = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", timeZone: "UTC" });

/** "[START_DATE]" מתמלא בתאריך מהתצורה; בלי תאריך מוגדר, המציין נשאר כלשונו (אין תאריך מומצא). */
export function withStartDate(text: string, startDate: string | undefined): string {
  if (!startDate) return text;
  return text.replaceAll("[START_DATE]", HE_DATE.format(new Date(`${startDate}T00:00:00Z`)));
}
