/** לכידת beforeinstallprompt (Chrome / Android). הכפתור "התקנה" מוצג רק אם האירוע באמת הופעל. */
type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * המצב יושב על globalThis ולא במשתני מודול: אם חבילת הקוד מפוצלת כך שהמודול הזה נטען בשני chunks (למשל אחרי שינוי
 * ב־imports של מסך אחר), לכל עותק היה deferred משלו, והאירוע שנלכד במסך הכניסה לא היה מגיע לדף /install.
 */
type Shared = { deferred: BeforeInstallPromptEvent | null; listeners: Set<() => void>; started: boolean };
const G = globalThis as unknown as { __tsaadInstall?: Shared };
const shared: Shared = (G.__tsaadInstall ??= { deferred: null, listeners: new Set(), started: false });
const emit = () => shared.listeners.forEach((l) => l());

/**
 * מחברים מאזינים, פעם אחת לכל טעינת דף. נקרא כבר בטעינת המודול (למטה): Chrome יכול להפעיל את האירוע לפני ש־React
 * סיים hydration, ואפילו במסך הכניסה, ואז הוא היה הולך לאיבוד. המודול נטען מ־PwaEarly ב־layout הראשי, ולכן גם
 * /login תופס אותו, והמצב נשמר בניווטים בצד הלקוח עד /install. מחזיר פונקציית ניקוי.
 */
export function captureInstallPrompt(): () => void {
  if (shared.started) return () => undefined;
  shared.started = true;
  const onPrompt = (e: Event) => {
    e.preventDefault();
    shared.deferred = e as BeforeInstallPromptEvent;
    emit();
  };
  const onInstalled = () => {
    shared.deferred = null;
    emit();
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    shared.started = false;
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

if (typeof window !== "undefined") captureInstallPrompt();

export const subscribeInstallPrompt = (cb: () => void) => {
  shared.listeners.add(cb);
  return () => void shared.listeners.delete(cb);
};
export const hasInstallPrompt = () => shared.deferred !== null;

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const e = shared.deferred;
  if (!e) return "unavailable";
  shared.deferred = null; // האירוע חד־פעמי
  emit();
  try {
    await e.prompt();
    return (await e.userChoice).outcome;
  } catch {
    return "dismissed";
  }
}

/** האם האפליקציה רצה כמותקנת (display-mode: standalone, או navigator.standalone ב־iOS). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios || window.matchMedia("(display-mode: standalone)").matches;
}
