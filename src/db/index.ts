import "server-only";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import { getConfig } from "@/config";
import { logger } from "@/lib/logger";
import { isLocalDatabaseUrl } from "./local-url";
import * as schema from "./schema";

export { schema };
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export { isLocalDatabaseUrl };

/**
 * חיבור שממתין בבריכה (idle) ונסגר מצד השרת (Neon סוגר WebSocket שקט) פולט "error" על הבריכה.
 * בלי מאזין, Node זורק "Unhandled error" מחוץ לכל בקשה ועלול להפיל את המופע. הבריכה כבר מוציאה את הלקוח הפגום,
 * והשאילתה הבאה פותחת חיבור חדש, אז מספיק לרשום ולהמשיך.
 */
function onIdleClientError(error: Error): void {
  logger.warn("db: idle pool client error (client dropped, next query reconnects)", { error });
}

/**
 * מחבר למסד: node-postgres למקומי/בדיקות (localhost), Neon serverless לפרודקשן.
 */
export function createDb(databaseUrl: string): Db {
  if (isLocalDatabaseUrl(databaseUrl)) {
    const pool = new PgPool({ connectionString: databaseUrl });
    pool.on("error", onIdleClientError);
    return drizzlePg(pool, { schema });
  }
  const pool = new NeonPool({ connectionString: databaseUrl });
  pool.on("error", onIdleClientError);
  return drizzleNeon(pool, { schema });
}

let cached: Db | undefined;

export function getDb(): Db {
  if (!cached) {
    const url = getConfig().env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    cached = createDb(url);
  }
  return cached;
}
