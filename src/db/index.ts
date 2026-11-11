import "server-only";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import { getConfig } from "@/config";
import { isLocalDatabaseUrl } from "./local-url";
import * as schema from "./schema";

export { schema };
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export { isLocalDatabaseUrl };

/**
 * מחבר למסד: node-postgres למקומי/בדיקות (localhost), Neon serverless לפרודקשן.
 */
export function createDb(databaseUrl: string): Db {
  if (isLocalDatabaseUrl(databaseUrl)) {
    return drizzlePg(new PgPool({ connectionString: databaseUrl }), { schema });
  }
  return drizzleNeon(new NeonPool({ connectionString: databaseUrl }), { schema });
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
