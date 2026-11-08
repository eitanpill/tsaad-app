/**
 * יוצר משתמש לפיתוח מקומי בלבד ומדפיס קישור הפעלה חד־פעמי ל־stdout.
 * רק hash של האסימון נשמר. אין שליחה לשום מקום.
 *
 * שימוש (מקומי):
 *   NODE_ENV=development DATABASE_URL=postgres://postgres@127.0.0.1:PORT/db \
 *     npx tsx scripts/create-dev-user.ts --username dana --name "דנה" --email dana@example.test
 *
 * מסרב לרוץ אלא אם NODE_ENV=development וגם DATABASE_URL מצביע ל־localhost.
 */
import { createHash, randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { isLocalDatabaseUrl } from "../src/db/local-url";
import { activationTokens, users } from "../src/db/schema";

/** ברירת מחדל לפיתוח בלבד. בפרודקשן הערך יוגדר דרך ACTIVATION_LINK_TTL_MINUTES. */
const DEV_DEFAULT_TTL_MINUTES = 60;

export function assertDevEnvironment(env: Record<string, string | undefined>): string {
  if (env.NODE_ENV !== "development") {
    throw new Error("Refusing to run: NODE_ENV must be 'development'.");
  }
  const url = env.DATABASE_URL;
  if (!url) throw new Error("Refusing to run: DATABASE_URL is not set.");
  // בודק גם פרמטרים כמו ?host= שעוקפים את המארח שבכתובת.
  if (!isLocalDatabaseUrl(url)) {
    throw new Error("Refusing to run: DATABASE_URL must point to localhost (no host overrides).");
  }
  return url;
}

export function parseArgs(argv: string[]): { username: string; name: string; email: string; phone?: string } {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const username = get("--username")?.trim().toLowerCase();
  const name = get("--name")?.trim();
  const email = get("--email")?.trim();
  if (!username || !/^[a-z0-9._-]{2,40}$/.test(username)) throw new Error("--username required (a-z, 0-9, . _ -, 2-40 chars)");
  if (!name) throw new Error("--name required");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("--email required");
  return { username, name, email, phone: get("--phone")?.trim() };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function main() {
  const url = assertDevEnvironment(process.env);
  const args = parseArgs(process.argv.slice(2));
  const ttlRaw = process.env.ACTIVATION_LINK_TTL_MINUTES;
  const ttl = ttlRaw ? Number(ttlRaw) : DEV_DEFAULT_TTL_MINUTES;
  if (!Number.isInteger(ttl) || ttl <= 0) throw new Error("ACTIVATION_LINK_TTL_MINUTES must be a positive integer");
  const origin = process.env.APP_ORIGIN || "http://localhost:3000";

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  try {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + ttl * 60_000);
    await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ username: args.username, displayName: args.name, email: args.email, phone: args.phone ?? null })
        .returning({ id: users.id });
      await tx.insert(activationTokens).values({
        userId: user.id,
        tokenHash: hashToken(token),
        purpose: "activate",
        expiresAt,
      });
    });
    // הקישור מודפס פעם אחת בלבד; לא נשמר בשום מקום מלבד ה־hash.
    console.log(`${origin}/activate?token=${token}`);
    console.error(`user '${args.username}' created; link expires ${expiresAt.toISOString()} (${ttl} min)`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
