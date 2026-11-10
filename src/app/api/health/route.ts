import { connection } from "next/server";
import { getDb } from "@/db";
import { checkDb, healthOf } from "@/lib/health";

/**
 * GET /api/health: לבדיקות זמינות (ניטור). פתוח לכולם, ולכן מחזיר רק { ok, db } (בלי גרסאות, סביבה, מחרוזות חיבור או שגיאות).
 * 200 כשהמסד נגיש; 503 כשלא. תמיד no-store. התוצאה נשמרת בזיכרון כמה שניות כדי שהקריאה לא תהפוך לעומס על המסד.
 */
const TTL_MS = 5000;
let last: { at: number; db: boolean } | undefined;

export async function GET() {
  await connection();
  const now = Date.now();
  if (!last || now - last.at > TTL_MS) last = { at: now, db: await checkDb(getDb) };
  const body = healthOf(last.db);
  return Response.json(body, { status: body.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
