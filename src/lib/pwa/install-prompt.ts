/** לכידת beforeinstallprompt (Chrome / Android). הכפתור "התקנה" מוצג רק אם האירוע באמת הופעל. */
type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let started = false;

/**
 * מחברים מאזינים, פעם אחת לכל טעינת דף. נקרא כבר בטעינת המודול (למטה): Chrome יכול להפעיל את האירוע לפני ש־React
 * סיים hydration, ואפילו במסך הכניסה, ואז הוא היה הולך לאיבוד. המודול נטען מ־PwaEarly ב־layout הראשי, ולכן גם
 * /login תופס אותו, והמצב נשמר בניווטים בצד הלקוח עד /install. מחזיר פונקציית ניקוי.
 */
export function captureInstallPrompt(): () => void {
  if (started) return () => undefined;
  started = true;
  const onPrompt = (e: Event) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  };
  const onInstalled = () => {
    deferred = null;
    emit();
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    started = false;
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

if (typeof window !== "undefined") captureInstallPrompt();

export const subscribeInstallPrompt = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
export const hasInstallPrompt = () => deferred !== null;

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const e = deferred;
  if (!e) return "unavailable";
  deferred = null; // האירוע חד־פעמי
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
