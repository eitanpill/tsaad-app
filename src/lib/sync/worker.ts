import "server-only";
import type { Db } from "@/db";
import { logger, type Logger } from "@/lib/logger";
import type { SyncAdapter } from "./adapter";
import { claimDue, markFailed, markSent, sanitizeError } from "./outbox";
import { TRACKER_KIND, trackerPayloadSchema } from "./payload";

export type SyncRunResult = {
  enabled: boolean;
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
};

const EMPTY: SyncRunResult = { enabled: false, claimed: 0, sent: 0, failed: 0, dead: 0 };

/**
 * ריצת סנכרון אחת. כש־enabled הוא לא בדיוק true, או שאין מתאם, לא נוגעים בתור ולא ברשת.
 * אין כאן שום קריאת רשת: כל השליחה עוברת דרך ה־adapter שהוזרק.
 */
export async function runSyncWorker(args: {
  db: Db;
  enabled: boolean;
  adapter: SyncAdapter | null;
  log?: Logger;
  random?: () => number;
}): Promise<SyncRunResult> {
  const log = args.log ?? logger;
  if (args.enabled !== true) return { ...EMPTY };
  if (!args.adapter) {
    log.warn("sync enabled but no adapter is wired; nothing processed");
    return { ...EMPTY, enabled: true };
  }
  const result: SyncRunResult = { ...EMPTY, enabled: true };
  const rows = await claimDue(args.db, undefined, undefined, [TRACKER_KIND]);
  result.claimed = rows.length;
  for (const row of rows) {
    let outcome: Awaited<ReturnType<SyncAdapter["send"]>>;
    try {
      const parsed = trackerPayloadSchema.safeParse(row.payload);
      if (!parsed.success) {
        outcome = { ok: false, retryable: false, error: "invalid payload" };
      } else {
        outcome = await args.adapter.send({ id: row.id, kind: row.kind, payload: parsed.data });
      }
    } catch (e) {
      outcome = { ok: false, retryable: true, error: sanitizeError(e) };
    }
    if (outcome.ok) {
      if (await markSent(args.db, row)) result.sent++;
    } else {
      const state = await markFailed(args.db, row, outcome.error, {
        retryable: outcome.retryable,
        random: args.random,
      });
      if (state === "dead") result.dead++;
      else if (state === "failed") result.failed++;
    }
  }
  log.info("sync run", { ...result });
  return result;
}
