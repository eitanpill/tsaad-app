import "server-only";
import { GHL } from "@/config/constants";

export type GhlResult = { ok: true } | { ok: false; retryable: boolean; error: string };

const CONTACT_ID = /^[A-Za-z0-9_-]{6,64}$/;

export type GhlClient = {
  /** מעדכן שדות מותאמים (לפי key) באיש קשר. */
  updateCustomFields(contactId: string, fields: { key: string; value: string }[], locationId?: string): Promise<GhlResult>;
  addTags(contactId: string, tags: string[]): Promise<GhlResult>;
  removeTags(contactId: string, tags: string[]): Promise<GhlResult>;
};

/**
 * לקוח GHL API v2 (Bearer, כותרת Version). הכתובת קבועה (GHL.baseUrl), https בלבד, בלי הפניות, עם timeout.
 * שגיאות לא כוללות כתובת, גוף תגובה או טוקן, רק קוד סטטוס. 429, 5xx ושגיאות רשת ניתנות לניסיון חוזר; 4xx אחרות לא.
 * `fetchImpl` מוזרק בבדיקות (אף בדיקה לא קוראת לרשת).
 */
export function createGhlClient(opts: { token: string; fetchImpl?: typeof fetch; timeoutMs?: number }): GhlClient {
  const doFetch = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? GHL.timeoutMs;

  async function call(method: "PUT" | "POST" | "DELETE", path: string, body: unknown, locationId?: string): Promise<GhlResult> {
    let res: Response;
    try {
      res = await doFetch(`${GHL.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${opts.token}`,
          Version: GHL.apiVersion,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      return { ok: false, retryable: true, error: timedOut ? "ghl timeout" : "ghl network error" };
    }
    const status = res.status;
    if (status >= 200 && status < 300) {
      // אם התשובה מזכירה מיקום אחר מזה שהוגדר, זה טוקן של תת־חשבון שגוי: לא ממשיכים.
      if (locationId) {
        try {
          const len = Number(res.headers.get("content-length"));
          if (!(len > GHL.maxResponseBytes)) {
            const json = JSON.parse((await res.text()).slice(0, GHL.maxResponseBytes)) as { contact?: { locationId?: unknown } };
            const seen = json?.contact?.locationId;
            if (typeof seen === "string" && seen !== locationId) {
              return { ok: false, retryable: false, error: "ghl location mismatch" };
            }
          }
        } catch {
          /* תשובה בלי גוף שימושי: בסדר */
        }
      } else {
        await res.body?.cancel().catch(() => undefined);
      }
      return { ok: true };
    }
    await res.body?.cancel().catch(() => undefined);
    if (status === 429 || status === 408 || status >= 500) return { ok: false, retryable: true, error: `ghl http ${status}` };
    if (status === 401 || status === 403) return { ok: false, retryable: false, error: `ghl http ${status} (token or scopes)` };
    return { ok: false, retryable: false, error: `ghl http ${status}` };
  }

  const guard = (contactId: string): GhlResult | null =>
    CONTACT_ID.test(contactId) ? null : { ok: false, retryable: false, error: "invalid contact id" };

  return {
    async updateCustomFields(contactId, fields, locationId) {
      const bad = guard(contactId);
      if (bad) return bad;
      return call(
        "PUT",
        `/contacts/${encodeURIComponent(contactId)}`,
        { customFields: fields.map((f) => ({ key: f.key, field_value: f.value })) },
        locationId,
      );
    },
    async addTags(contactId, tags) {
      const bad = guard(contactId);
      return bad ?? call("POST", `/contacts/${encodeURIComponent(contactId)}/tags`, { tags });
    },
    async removeTags(contactId, tags) {
      const bad = guard(contactId);
      return bad ?? call("DELETE", `/contacts/${encodeURIComponent(contactId)}/tags`, { tags });
    },
  };
}

/** מעדכן שדה (עם הערך) ואז מוסיף תג שמפעיל Workflow. rearm: מסיר את התג קודם (כך שגם תג שכבר קיים יפעיל שוב). */
export async function setFieldAndTag(
  client: GhlClient,
  args: { contactId: string; fieldKey: string; value: string; tag: string; rearm: boolean; locationId?: string },
): Promise<GhlResult> {
  const upd = await client.updateCustomFields(args.contactId, [{ key: args.fieldKey, value: args.value }], args.locationId);
  if (!upd.ok) return upd;
  if (args.rearm) await client.removeTags(args.contactId, [args.tag]); // best effort
  return client.addTags(args.contactId, [args.tag]);
}
