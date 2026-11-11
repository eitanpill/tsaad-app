/**
 * יוצר חשבון (או קישור חדש לחשבון קיים) ומדפיס קישור חד־פעמי ל־/activate ל־stdout, פעם אחת בלבד.
 * רק ה־hash נשמר במסד, והתוקף הוא ACTIVATION_LINK_TTL_MINUTES (ברירת מחדל 4320 = 3 ימים). לא שולח כלום לשום מקום.
 * בניגוד ל־create-dev-user, הסקריפט הזה רץ גם מול מסד מרוחק (פרודקשן), ולכן הוא דורש --confirm-production ו־APP_ORIGIN.
 *
 * הרצה (במחשב של הבעלים, עם DATABASE_URL ו־APP_ORIGIN מתוך .env.local):
 *   npm run admin:create-user -- --confirm-production --username pit --name "פיט" --email pit@example.com --phone 050-123-4567
 *   npm run admin:create-user -- --confirm-production --username pit --new-link     # קישור חדש לחשבון קיים
 * (npm run משתמש ב־node --env-file=.env.local ... ; ראו package.json. התנאי react-server נחוץ כי המודולים המשותפים עם
 *  האפליקציה מייבאים "server-only".)
 *
 * לפני כל כתיבה מוצג שם המארח של המסד, וצריך לאשר אותו: בהרצה אינטראקטיבית מקלידים אותו; בלי מסוף (סקריפט) חייבים
 * --db-host <host> שתואם בדיוק. כך הרצה מול מסד לא נכון (‎.env.local של פרויקט אחר) נעצרת לפני שנכתב משהו.
 *
 * --new-link: חשבון שלא הופעל מקבל קישור הפעלה חדש, חשבון שהופעל מקבל קישור איפוס סיסמה. הקישור הקודם מבוטל. חשבון מושבת לא מקבל.
 */
import { pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { ADMIN_USERNAME_RE, createParticipant, issueParticipantLink, normalizeContact } from "../src/lib/admin/participants";
import { cleanName } from "../src/lib/webhooks/ghl/normalize";

export const DEFAULT_TTL_MINUTES = 4320;

export type Args = {
  username: string;
  name?: string;
  email?: string;
  phone?: string;
  newLink: boolean;
  confirmProduction: boolean;
  /** אישור לא־אינטראקטיבי של מארח המסד: חייב להיות זהה למארח שב־DATABASE_URL. */
  dbHost?: string;
};

const VALUE_FLAGS = new Set(["--username", "--name", "--email", "--phone", "--db-host"]);
const BOOL_FLAGS = new Set(["--new-link", "--confirm-production"]);

/** מנתח argv. זורק שגיאה ברורה על דגל לא מוכר, ערך חסר, או קלט לא תקין. מנרמל טלפון כמו ה־webhook. */
export function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  const bools = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    let flag = argv[i];
    let inline: string | undefined;
    const eq = flag.indexOf("=");
    if (flag.startsWith("--") && eq > 0) {
      inline = flag.slice(eq + 1);
      flag = flag.slice(0, eq);
    }
    if (BOOL_FLAGS.has(flag) && inline === undefined) {
      bools.add(flag);
    } else if (VALUE_FLAGS.has(flag)) {
      const v = inline ?? argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`${flag} needs a value`);
      if (values.has(flag)) throw new Error(`${flag} given twice`);
      values.set(flag, v);
    } else {
      throw new Error(`unknown argument: ${flag}`);
    }
  }

  const username = values.get("--username")?.trim().toLowerCase();
  if (!username || !ADMIN_USERNAME_RE.test(username)) {
    throw new Error("--username required (a-z, 0-9, . _ -, 3-40 chars, starts and ends with a letter or digit)");
  }
  const newLink = bools.has("--new-link");
  const confirmProduction = bools.has("--confirm-production");
  const rawName = values.get("--name");
  const rawEmail = values.get("--email");
  const rawPhone = values.get("--phone");
  const dbHost = values.get("--db-host")?.trim().toLowerCase() || undefined;

  if (newLink) {
    if (rawName || rawEmail || rawPhone) throw new Error("--new-link takes only --username (the account already exists)");
    return { username, newLink, confirmProduction, ...(dbHost ? { dbHost } : {}) };
  }
  if (!rawName || !cleanName(rawName)) throw new Error("--name required");
  const contact = normalizeContact({ email: rawEmail, phone: rawPhone });
  if (!contact.ok) throw new Error("a valid --email and/or --phone is required (phone: Israeli number or +international)");
  return {
    username,
    name: cleanName(rawName)!,
    email: contact.email ?? undefined,
    phone: contact.phone ?? undefined,
    newLink,
    confirmProduction,
    ...(dbHost ? { dbHost } : {}),
  };
}

export type Guarded = { databaseUrl: string; origin: string; ttlMinutes: number; dbHost: string };

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * תנאי ההרצה: --confirm-production, DATABASE_URL, APP_ORIGIN (origin תקין, https חוץ מ־localhost) ו־TTL תקין.
 * מחזיר גם את שם המארח של המסד (בלי פרטי התחברות), להדפסה לבעלים לפני הכתיבה.
 */
export function assertGuards(env: Record<string, string | undefined>, args: Pick<Args, "confirmProduction">): Guarded {
  if (!args.confirmProduction) {
    throw new Error("Refusing to run: pass --confirm-production (this script writes to the database in DATABASE_URL, which may be production).");
  }
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("Refusing to run: DATABASE_URL is not set (load .env.local).");
  let dbHost: string;
  try {
    dbHost = new URL(databaseUrl).hostname;
  } catch {
    throw new Error("Refusing to run: DATABASE_URL is not a valid URL.");
  }
  const rawOrigin = env.APP_ORIGIN?.trim();
  if (!rawOrigin) throw new Error("Refusing to run: APP_ORIGIN is not set (the link needs the site address).");
  let origin: string;
  try {
    const u = new URL(rawOrigin);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && LOOPBACK.has(u.hostname))) {
      throw new Error("scheme");
    }
    origin = u.origin;
  } catch {
    throw new Error("Refusing to run: APP_ORIGIN must be an https origin such as https://example.com (http only for localhost).");
  }
  const ttlRaw = env.ACTIVATION_LINK_TTL_MINUTES?.trim();
  const ttlMinutes = ttlRaw ? Number(ttlRaw) : DEFAULT_TTL_MINUTES;
  if (!Number.isInteger(ttlMinutes) || ttlMinutes <= 0) throw new Error("ACTIVATION_LINK_TTL_MINUTES must be a positive integer");
  return { databaseUrl, origin, ttlMinutes, dbHost };
}

/**
 * אישור מארח המסד לפני כתיבה. typed: מה שהוקלד בתשובה לשאלה (מסוף), או ערך --db-host. בלי אף אחד מהם: סירוב.
 * ההשוואה מדויקת (בלי הבדל גודל אותיות), כדי שמסד אחר לא יאושר בטעות.
 */
export function confirmDbHost(actual: string, typed: string | undefined): void {
  if (typed === undefined) {
    throw new Error(`Refusing to run: confirm the database host. Run in a terminal and type it, or pass --db-host ${actual}`);
  }
  if (typed.trim().toLowerCase() !== actual.toLowerCase()) {
    throw new Error(`Refusing to run: the confirmed host does not match DATABASE_URL (${actual}). Nothing was written.`);
  }
}

async function askHost(): Promise<string | undefined> {
  if (!process.stdin.isTTY) return undefined;
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return await rl.question("Type the database host above to write to it: ");
  } finally {
    rl.close();
  }
}

export type RunResult = { kind: "created" | "activate" | "reset"; link: string; expiresAt: Date; username: string };

/** הלוגיקה, בנפרד מ־main כדי שאפשר יהיה לבדוק אותה מול מסד בדיקות. לא מדפיסה ולא שולחת כלום. */
export async function run(
  db: Parameters<typeof createParticipant>[0],
  args: Args,
  g: Pick<Guarded, "origin" | "ttlMinutes">,
): Promise<RunResult> {
  if (args.newLink) {
    const r = await issueParticipantLink(db, { username: args.username, ttlMinutes: g.ttlMinutes });
    if (!r.ok) {
      throw new Error(r.error === "disabled" ? "the account is disabled; enable it in /admin/participants first" : `no account with username '${args.username}'`);
    }
    return { kind: r.purpose, link: `${g.origin}/activate?token=${r.link.token}`, expiresAt: r.link.expiresAt, username: r.username };
  }
  const r = await createParticipant(db, {
    displayName: args.name!,
    email: args.email,
    phone: args.phone,
    username: args.username,
    ttlMinutes: g.ttlMinutes,
  });
  if (!r.ok) {
    if (r.error === "username_taken") throw new Error(`username '${args.username}' already exists; add --new-link to issue a fresh link for it`);
    throw new Error(`invalid input (${r.error})`);
  }
  return { kind: "created", link: `${g.origin}/activate?token=${r.link.token}`, expiresAt: r.link.expiresAt, username: r.username };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const g = assertGuards(process.env, args);
  console.error(`database host: ${g.dbHost}`);
  confirmDbHost(g.dbHost, args.dbHost ?? (await askHost()));
  const pool = new Pool({ connectionString: g.databaseUrl });
  const db = drizzle(pool, { schema });
  try {
    const r = await run(db, args, g);
    // הקישור מודפס פעם אחת בלבד, ל־stdout; לא נשמר בשום מקום מלבד ה־hash. הודעות שאינן הקישור: ל־stderr.
    console.log(r.link);
    const what = r.kind === "created" ? "created" : r.kind === "activate" ? "new activation link issued" : "password reset link issued";
    console.error(`user '${r.username}': ${what}; link expires ${r.expiresAt.toISOString()} (${g.ttlMinutes} min). Nothing was sent; send the link yourself.`);
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
