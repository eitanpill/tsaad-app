"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { copy } from "@/content/copy.he";
import { hasInstallPrompt, isStandalone, promptInstall, subscribeInstallPrompt } from "@/lib/pwa/install-prompt";
import { detectPlatform, ORDER, type InstallPlatform } from "@/lib/pwa/platform";
import { paint } from "@/components/paint";

const noopSubscribe = () => () => undefined;
const t = copy.install;

/** סמלים קטנים שנראים כמו הכפתורים בטלפון עצמו, כדי שיהיה קל לזהות אותם. דקורטיביים: הטקסט תמיד אומר את אותו הדבר. */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <span className="in-glyph" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        {children}
      </svg>
    </span>
  );
}
const G = {
  share: (
    <Glyph>
      <path d="M8 9H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-2" />
      <path d="M12 3v12M8 7l4-4 4 4" />
    </Glyph>
  ),
  add: (
    <Glyph>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </Glyph>
  ),
  dotsV: (
    <Glyph>
      <circle cx="12" cy="5" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" />
    </Glyph>
  ),
  copy: (
    <Glyph>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </Glyph>
  ),
  compass: (
    <Glyph>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </Glyph>
  ),
  installPc: (
    <Glyph>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 7v6M9.5 10.5L12 13l2.5-2.5" />
    </Glyph>
  ),
  bolt: (
    <Glyph>
      <path d="M13 3L5 14h6l-1 7 8-11h-6z" />
    </Glyph>
  ),
  bell: (
    <Glyph>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Glyph>
  ),
  full: (
    <Glyph>
      <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
    </Glyph>
  ),
  leaf: (
    <Glyph>
      <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" />
      <path d="M5 19l7-7" />
    </Glyph>
  ),
};

const WHY_ICONS = [G.bolt, G.bell, G.full, G.leaf];

type Step = readonly [string, string];
const DEVICES: Record<InstallPlatform, { heading: string; lead?: string; steps: readonly Step[]; icons: (ReactNode | null)[] }> = {
  "ios-safari": { heading: t.iphone.heading, steps: t.iphone.steps, icons: [G.share, G.add, null, null] },
  "ios-other": { heading: t.iphoneOther.heading, lead: t.iphoneOther.lead, steps: t.iphoneOther.steps, icons: [G.copy, G.compass, G.share] },
  android: { heading: t.android.heading, steps: t.android.steps, icons: [G.dotsV, G.add, null] },
  desktop: { heading: t.desktop.heading, lead: t.desktop.lead, steps: t.desktop.steps, icons: [G.installPc, null] },
};

const readPlatform = () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);

/** העתקת כתובת האתר, כדי לפתוח אותה בספארי. אם הדפדפן לא מרשה להעתיק, הכתובת מוצגת להעתקה ידנית. */
function CopyLink() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const url = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <div className="in-copy">
      <button
        type="button"
        className="btn-s"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.origin);
            setState("copied");
          } catch {
            setState("failed");
          }
        }}
      >
        {t.iphoneOther.copy}
      </button>
      <p className="in-copy-status" role="status">
        {state === "copied" ? t.iphoneOther.copied : state === "failed" ? `${t.iphoneOther.copyFailed} ${url}` : ""}
      </p>
    </div>
  );
}

/**
 * מסך ההתקנה: למה כדאי, ואיך מוסיפים בכל מכשיר. ההוראות של המכשיר שזוהה מוצגות ראשונות ופתוחות, והשאר מקופלות
 * (details/summary, נגיש למקלדת ולקורא מסך בלי קוד נוסף). אם האפליקציה כבר רצה מהמסך הראשי ההוראות מוסתרות.
 * כפתור "התקנה" מופיע רק אם הדפדפן הפעיל beforeinstallprompt (ראו lib/pwa/install-prompt.ts, נלכד במעטפת).
 * "אחר כך" ו"הוספתי" רק מנווטים למסך היום: אין מעקב ואין שמירה של הבחירה.
 */
export function InstallGuide() {
  const standalone = useSyncExternalStore(noopSubscribe, isStandalone, () => false);
  const canPrompt = useSyncExternalStore(subscribeInstallPrompt, hasInstallPrompt, () => false);
  const platform = useSyncExternalStore<InstallPlatform | "unknown">(noopSubscribe, readPlatform, () => "unknown");
  const [asked, setAsked] = useState(false);
  const order = ORDER[platform];

  return (
    <>
      <section className="t t-in-hero" aria-labelledby="in-h">
        <div className="in-icon" aria-hidden="true">
          <svg width="48" height="58" viewBox="0 0 40 48" focusable="false">
            <clipPath id="in-glass">
              <path d="M5 4 L35 4 L31 44 L9 44 Z" />
            </clipPath>
            <g clipPath="url(#in-glass)">
              <g transform="translate(0 22)">
                <path className="in-wave" d="M-40 0 Q-30 -4 -20 0 T0 0 T20 0 T40 0 T60 0 V60 H-40 Z" style={paint("white")} />
              </g>
            </g>
            <path d="M5 4 L35 4 L31 44 L9 44 Z" fill="none" strokeWidth="3.2" strokeLinejoin="round" style={paint(null, "white")} />
          </svg>
        </div>
        <div>
          <h1 id="in-h">{t.title}</h1>
          <p>{standalone ? t.installed : t.lead}</p>
        </div>
      </section>

      {standalone ? null : (
        <>
          <section className="t t-in-why" aria-labelledby="in-why-h">
            <h2 id="in-why-h">{t.why.heading}</h2>
            <ul className="in-why-list">
              {t.why.items.map(([title, sub], i) => (
                <li key={title}>
                  {WHY_ICONS[i]}
                  <span>
                    <b>{title}</b>
                    <span className="in-sub">{sub}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="t t-in-how" aria-labelledby="in-how-h">
            <h2 id="in-how-h">{t.how.heading}</h2>
            {platform === "unknown" ? null : <p className="in-how-lead">{t.how.lead}</p>}

            {canPrompt ? (
              <div className="in-prompt">
                <p>{t.prompt.lead}</p>
                <button
                  type="button"
                  className="btn-s in-install"
                  disabled={asked}
                  onClick={async () => {
                    setAsked(true);
                    const r = await promptInstall();
                    if (r === "dismissed") setAsked(false);
                  }}
                >
                  {t.prompt.button}
                </button>
              </div>
            ) : null}

            {/* key: אחרי הזיהוי בצד הלקוח הרשימה נבנית מחדש, כדי שהמכשיר שזוהה ייפתח */}
            <div className="in-devices" key={platform}>
              {order.map((id, idx) => {
                const d = DEVICES[id];
                const mine = platform !== "unknown" && idx === 0;
                return (
                  <details key={id} className={`in-dev in-dev--${id}`} open={idx === 0}>
                    <summary>
                      <span className="in-dev-title">
                        <span className="in-dev-name">{d.heading}</span>
                        {mine ? <span className="in-badge">{t.how.yours}</span> : null}
                      </span>
                    </summary>
                    <div className="in-dev-body">
                      {d.lead ? <p className="in-dev-lead">{d.lead}</p> : null}
                      <ol aria-label={`${copy.a11y.install.stepList}, ${d.heading}`} className="in-steps">
                        {d.steps.map(([title, sub], i) => (
                          <li key={title}>
                            <span className="in-num" aria-hidden="true">
                              {i + 1}
                            </span>
                            <span className="in-step-text">
                              <b>{title}</b>
                              <span className="in-sub">{sub}</span>
                            </span>
                            {d.icons[i] ?? null}
                          </li>
                        ))}
                      </ol>
                      {id === "ios-other" ? (
                        <>
                          <CopyLink />
                          <p className="in-note">{t.iphoneOther.inApp}</p>
                        </>
                      ) : null}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        </>
      )}

      <section className="t t-in-actions">
        <Link href="/today" className="in-done">
          {standalone ? copy.locked.backToToday : t.done}
        </Link>
        {standalone ? null : (
          <Link href="/today" className="in-later" aria-label={copy.a11y.install.later}>
            {t.later}
          </Link>
        )}
      </section>
    </>
  );
}
