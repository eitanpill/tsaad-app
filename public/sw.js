/*
 * Service worker של צעד קטן ביום. שלוש משימות בלבד:
 *  1. push: מציג התראה (title, body, url מהמטען).
 *  2. notificationclick: פותח או ממקד חלון באותו origin בלבד.
 *  3. cache: רק נכסים סטטיים בלתי־משתנים (/_next/static/*, /icons/*, ודף ה־offline). לעולם לא HTML, לא RSC,
 *     לא /api ולא שום דבר אישי: ל־HTML יש nonce שונה בכל בקשה (CSP), והוא תלוי בסשן.
 * ניווט: רשת קודם; אם אין רשת, offline.html (סטטי, בלי nonce, בלי תוכן אישי). אין שמירה של דפים.
 * כשמשנים את הקובץ הזה, מעלים את VERSION: מטמונים ישנים נמחקים בהפעלה.
 */
const VERSION = "v1";
const STATIC_CACHE = `tsaad-static-${VERSION}`;
const OFFLINE_CACHE = `tsaad-offline-${VERSION}`;
const KEEP = new Set([STATIC_CACHE, OFFLINE_CACHE]);
const OFFLINE_URLS = ["/offline.html", "/offline.css", "/icons/icon-192.png"];
const MAX_STATIC_ENTRIES = 120;
const ICON = "/icons/icon-192.png";
const FALLBACK_TITLE = "צעד קטן ביום";
const DEFAULT_URL = "/today";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((c) => c.addAll(OFFLINE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** נכס סטטי בלתי־משתנה: קבצים עם hash של Next, ואייקונים. הכול GET באותו origin. */
function isCacheableStatic(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/offline.css")
  );
}

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_STATIC_ENTRIES; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ניווט (דף HTML): רשת קודם, בלי שמירה. רק כשאין רשת: דף ה־offline הסטטי.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match("/offline.html", { cacheName: OFFLINE_CACHE })) || Response.error()),
    );
    return;
  }

  // נכסים סטטיים: מטמון קודם, ואם אין, רשת ושמירה (רק תשובה תקינה ובסיסית).
  if (isCacheableStatic(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        // גם מה שנשמר מראש להתקנה (דף ה־offline והאייקון שלו) נענה מהמטמון.
        const hit = await caches.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type === "basic") {
          await cache.put(req, res.clone());
          await trim(cache);
        }
        return res;
      }),
    );
  }
  // כל השאר (api, RSC, תמונות אישיות, וידאו): ברירת המחדל של הדפדפן, ישר לרשת.
});

/** כתובת בטוחה לפתיחה: אותו origin בלבד; אחרת מסך היום. */
function safeTarget(raw) {
  try {
    const u = new URL(typeof raw === "string" ? raw : DEFAULT_URL, self.location.origin);
    return u.origin === self.location.origin ? u.pathname + u.search : DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : undefined);
  const title = str(data.title, 100) || FALLBACK_TITLE;
  const options = {
    body: str(data.body, 300) || "",
    icon: ICON,
    badge: ICON,
    lang: "he",
    dir: "rtl",
    tag: str(data.tag, 60) || "tsaad",
    data: { url: safeTarget(data.url) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeTarget(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (list) => {
      for (const client of list) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          await client.focus();
          if (new URL(client.url).pathname + new URL(client.url).search !== target && "navigate" in client) {
            await client.navigate(target);
          }
          return;
        } catch {
          /* ננסה את הבא, ובסוף נפתח חלון חדש */
        }
      }
      await self.clients.openWindow(target);
    }),
  );
});
