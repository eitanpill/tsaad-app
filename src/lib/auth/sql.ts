import "server-only";

/** node-postgres ו־Neon מחזירים { rows }; מאחדים לצורה אחת. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}
