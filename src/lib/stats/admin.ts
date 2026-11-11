/** שמות המשתמש המורשים לדף הסטטיסטיקה: רשימה מופרדת בפסיקים, בלי רווחים ובלי הבדל גודל אותיות. ריק או לא מוגדר = אף אחד. */
export function parseAdminUsernames(raw: string | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminUsername(username: string | null | undefined, raw: string | undefined): boolean {
  if (!username) return false;
  return parseAdminUsernames(raw).has(username.trim().toLowerCase());
}
