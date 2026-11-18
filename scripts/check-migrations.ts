/**
 * בדיקה לפני העלאה: עוצרת (exit 1) אם במסד חסרה מיגרציה שהקוד בתיקייה הזאת צריך.
 * בלי זה אפשר להעלות קוד חדש למסד ישן, ואז מסך שקורא טבלה חדשה נופל ל"משהו לא עבד" (כך קרה ל־/path עם 0016).
 *
 * הרצה (במחשב של הבעלים, עם .env.local): npm run db:check
 * משתמשת ב־DATABASE_URL_UNPOOLED אם קיים, אחרת DATABASE_URL. רק קוראת; לא משנה כלום. מדפיסה את שם המארח בלבד, בלי סיסמה.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { pendingMigrations, type JournalEntry } from "../src/db/pending-migrations";

export async function main(): Promise<number> {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set (expected in .env.local).");
    return 2;
  }
  let host = "?";
  try {
    host = new URL(url).hostname;
  } catch {
    /* host stays "?" */
  }
  const journal = JSON.parse(readFileSync(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
    entries: JournalEntry[];
  };
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const exists = await pool.query(`select to_regclass('drizzle.__drizzle_migrations') as t`);
    const applied = exists.rows[0]?.t
      ? (await pool.query(`select created_at from drizzle.__drizzle_migrations`)).rows.map((r) => r.created_at as string)
      : [];
    const pending = pendingMigrations(journal, applied);
    if (pending.length === 0) {
      console.log(`OK: all ${journal.entries.length} migrations are applied on ${host}.`);
      return 0;
    }
    console.error(`STOP: ${pending.length} migration(s) not applied on ${host}: ${pending.join(", ")}`);
    console.error(`Run first: DATABASE_URL="$DATABASE_URL_UNPOOLED" npx drizzle-kit migrate`);
    return 1;
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error("Migration check failed:", err instanceof Error ? err.message : err);
      process.exit(2);
    },
  );
}
