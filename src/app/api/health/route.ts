import { connection } from "next/server";
import { getDb } from "@/db";
import { checkDb, healthOf } from "@/lib/health";

/**
 * GET /api/health: לבדיקות זמינות (ניטור). פתוח לכולם, ולכן מחזיר רק { ok, db } (בלי גרסאות, סביבה, מחרוזות חיבור או שגיאות).
 * 200 כשהמסד נגיש; 503 כשלא. תמיד no-store. התוצאה נשמרת בזיכרון כמה שניות כדי שהקריאה לא תהפוך לעומס על המסד,
 * וגם בקשות שמגיעות יחד כשהתוצאה פגה חולקות בדיקה אחת (in-flight), כך שלכל מופע יש לכל היותר בדיקה אחת בכל TTL.
 */
const TTL_MS = 5000;
let last: { at: number; db: boolean } | undefined;
let inflight: Promise<boolean> | undefined;

function probe(): Promise<boolean> {
  inflight ??= checkDb(getDb)
    .then((db) => {
      last = { at: Date.now(), db };
      return db;
    })
    .finally(() => {
      inflight = undefined;
    });
  return inflight;
}

export async function GET() {
  await connection();
  const fresh = last && Date.now() - last.at <= TTL_MS;
  const db = fresh ? last!.db : await probe();
  const body = healthOf(db);
  return Response.json(body, { status: body.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
