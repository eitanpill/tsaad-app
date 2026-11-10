import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";

export type Health = { ok: boolean; db: boolean };

const sleep = <T,>(ms: number, v: T) => new Promise<T>((r) => setTimeout(() => r(v), ms));

/** האם המסד זמין: `select 1` עם תקרת זמן. בולע כל שגיאה (אין פרטי שגיאה, מחרוזות חיבור או גרסאות בתשובה). */
export async function checkDb(getDb: () => Db, timeoutMs = 2000): Promise<boolean> {
  try {
    const probe = getDb().execute(sql`select 1`).then(() => true);
    probe.catch(() => undefined);
    return await Promise.race([probe, sleep(timeoutMs, false)]);
  } catch {
    return false;
  }
}

/** ok = האפליקציה עונה והמסד נגיש. התשובה היא רק { ok, db }. */
export function healthOf(db: boolean): Health {
  return { ok: db, db };
}
