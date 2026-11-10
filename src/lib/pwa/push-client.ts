/** עזרי לקוח להתראות (דפדפן בלבד; בלי תלות ב־React). נבדקים בבדיקות יחידה עם mock של ה־API. */

/** מפתח VAPID ציבורי (base64url) ל־Uint8Array, כפי ש־pushManager.subscribe דורש. */
export function urlBase64ToUint8Array(b64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export type ReminderStatus = "checking" | "on" | "off" | "blocked" | "unsupported" | "error";

/** המצב ההתחלתי, לפי מה שהדפדפן יודע (בלי בקשת הרשאה). */
export async function detectStatus(vapidKey: string | null): Promise<ReminderStatus> {
  if (!vapidKey || !pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  try {
    return (await reconcileSubscription()) ? "on" : "off";
  } catch {
    return "off";
  }
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

let reconciling: Promise<boolean> | null = null;

/**
 * מתאם בין המנוי של הדפדפן לבין המשתמש המחובר: מנוי מקומי נחשב פעיל רק אם השרת אומר שהוא רשום למשתמש הזה.
 * אחרת (מנוי שנשאר ממשתמש קודם באותו דפדפן, או שנמחק בשרת) הוא מבוטל כאן, והשרת מוחק את השורה של הקודם.
 * כשל רשת: לא נוגעים במנוי, ומחזירים את מה שהדפדפן יודע. קריאות מקבילות (המעטפת ומסך התזכורות) חולקות בקשה אחת.
 */
export function reconcileSubscription(): Promise<boolean> {
  reconciling ??= (async () => {
    const sub = await currentSubscription();
    if (!sub) return false;
    const json = sub.toJSON();
    let res: Response;
    try {
      res = await fetch("/api/push/status", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
    } catch {
      return true;
    }
    if (!res.ok) return true;
    const body = (await res.json().catch(() => null)) as { registered?: unknown } | null;
    if (body?.registered === true) return true;
    await sub.unsubscribe().catch(() => undefined);
    return false;
  })().finally(() => {
    reconciling = null;
  });
  return reconciling;
}

/**
 * ביציאה: מבטל את המנוי של הדפדפן ומחזיר את הכתובת שלו, כדי שהשרת ימחק את השורה (logoutAction).
 * לא זורק ולא מחכה יותר מ־timeoutMs: יציאה לא נתקעת בגלל התראות.
 */
export async function releaseSubscriptionForLogout(timeoutMs = 2000): Promise<string | null> {
  if (!pushSupported()) return null;
  const work = (async () => {
    const sub = await currentSubscription();
    if (!sub) return null;
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => undefined);
    return endpoint;
  })().catch(() => null);
  return Promise.race([work, new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]);
}

const READY_TIMEOUT_MS = 10_000;

/** רישום ה־service worker (אם עוד לא) והמתנה שיהיה פעיל. */
export async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("sw not ready")), READY_TIMEOUT_MS)),
  ]);
}

async function postSubscription(sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON();
  const res = await fetch("/api/push", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  return res.ok;
}

export type EnableResult = Exclude<ReminderStatus, "checking" | "unsupported" | "off"> | "off";

/** הפעלה: בקשת הרשאה (חייבת לבוא מלחיצה), מנוי בדפדפן, ורישום בשרת. אם הרישום בשרת נכשל, המנוי המקומי מבוטל. */
export async function enableReminders(vapidKey: string): Promise<EnableResult> {
  try {
    const perm = await Notification.requestPermission();
    if (perm === "denied") return "blocked";
    if (perm !== "granted") return "off";
    const reg = await ensureRegistration();
    const key = urlBase64ToUint8Array(vapidKey);
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      } catch (e) {
        // מנוי ישן עם מפתח אחר: מבטלים ומנסים פעם אחת.
        if (!(e instanceof DOMException && e.name === "InvalidStateError")) throw e;
        await (await reg.pushManager.getSubscription())?.unsubscribe();
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      }
    }
    if (!(await postSubscription(sub))) {
      await sub.unsubscribe().catch(() => undefined);
      return "error";
    }
    return "on";
  } catch {
    return "error";
  }
}

/** כיבוי: מחיקה בשרת קודם (אם נכשלה, נשארים במצב "פעיל"), ואז ביטול המנוי בדפדפן. */
export async function disableReminders(): Promise<"off" | "error"> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const res = await fetch("/api/push", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      if (!res.ok) return "error";
      await sub.unsubscribe();
    }
    return "off";
  } catch {
    return "error";
  }
}
