/**
 * אילו מיגרציות מתוך drizzle/meta/_journal.json עוד לא הורצו על מסד נתון.
 * drizzle-kit migrate רושם כל מיגרציה בטבלה drizzle.__drizzle_migrations עם created_at = ה־when שלה ביומן,
 * ולכן מיגרציה שה־when שלה לא מופיע שם היא מיגרציה שלא הורצה.
 * ללא server-only: טהור, נבדק ביחידות, ומשמש את scripts/check-migrations.ts לפני העלאה.
 */
export type JournalEntry = { idx: number; when: number; tag: string };

export function pendingMigrations(
  journal: { entries: readonly JournalEntry[] },
  appliedCreatedAt: ReadonlyArray<number | string | bigint>,
): string[] {
  const applied = new Set(appliedCreatedAt.map((v) => Number(v)));
  return [...journal.entries]
    .sort((a, b) => a.idx - b.idx)
    .filter((e) => !applied.has(e.when))
    .map((e) => e.tag);
}
