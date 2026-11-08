import "server-only";
import type { TrackerPayload } from "./payload";

export type SyncItem = { id: string; kind: string; payload: TrackerPayload };

export type SyncResult =
  | { ok: true }
  | { ok: false; retryable: boolean; error: string };

/**
 * מתאם סנכרון אל GHL. כרגע קיים רק מתאם mock.
 *
 * TODO (שער G3): מתאם HTTP אמיתי ל־GHL. הוא לא נבנה בשלב 6 בכוונה, כדי שלא תהיה
 * בקוד אף דרך לשלוח לרשת. כשיבנה, חייב להיבחר רק ב־getSyncAdapter() כש־
 * TRACKER_SYNC_ENABLED הוא בדיוק true ויש GHL_WEBHOOK_URL, ורק אחרי אישור השער.
 */
export interface SyncAdapter {
  readonly name: string;
  send(item: SyncItem): Promise<SyncResult>;
}

export type MockSyncAdapter = SyncAdapter & {
  readonly calls: readonly SyncItem[];
  /** תוצאות לפי הסדר לקריאות הבאות (למשל כישלון); אחרי שנגמרו, ok. */
  queueResults(...results: SyncResult[]): void;
};

/** מתאם שרק רושם קריאות בזיכרון. לא נוגע ברשת. */
export function createMockSyncAdapter(): MockSyncAdapter {
  const calls: SyncItem[] = [];
  const results: SyncResult[] = [];
  return {
    name: "mock",
    calls,
    queueResults: (...r) => {
      results.push(...r);
    },
    async send(item) {
      calls.push(item);
      return results.shift() ?? { ok: true };
    },
  };
}

/**
 * בחירת המתאם לריצת cron. בשלב 6 תמיד null: אין מתאם אמיתי, ולכן גם עם
 * TRACKER_SYNC_ENABLED=true הוורקר לא מעבד כלום ולא מסמן שורות כ"נשלחו".
 */
export function getSyncAdapter(): SyncAdapter | null {
  return null;
}
