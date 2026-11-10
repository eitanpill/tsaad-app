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
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    return sub ? "on" : "off";
  } catch {
    return "off";
  }
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
