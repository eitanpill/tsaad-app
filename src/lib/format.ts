/** ממלא משתנים בסוגריים מסולסלים, למשל "{seconds}", בטקסטים מ־copy.he.ts. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (Object.hasOwn(values, k) ? String(values[k]) : m));
}
