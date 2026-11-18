"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { copy } from "@/content/copy.he";
import { hasInstallPrompt, isStandalone, promptInstall, subscribeInstallPrompt } from "@/lib/pwa/install-prompt";
import { paint } from "@/components/paint";

const noopSubscribe = () => () => undefined;

const IPHONE_STEPS = [
  [copy.install.iphone.step1, copy.install.iphone.step1Sub],
  [copy.install.iphone.step2, copy.install.iphone.step2Sub],
  [copy.install.iphone.step3, copy.install.iphone.step3Sub],
] as const;

/**
 * מסך ההתקנה. אם האפליקציה כבר רצה מהמסך הראשי (display-mode: standalone) ההוראות מוסתרות.
 * כפתור "התקנה" מופיע רק אם הדפדפן הפעיל beforeinstallprompt (ראו lib/pwa/install-prompt.ts, נלכד במעטפת).
 * "אחר כך" ו"הוספתי" רק מנווטים למסך היום: אין מעקב ואין שמירה של הבחירה.
 */
export function InstallGuide() {
  const standalone = useSyncExternalStore(noopSubscribe, isStandalone, () => false);
  const canPrompt = useSyncExternalStore(subscribeInstallPrompt, hasInstallPrompt, () => false);
  const [asked, setAsked] = useState(false);

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
          <h1 id="in-h">{copy.install.title}</h1>
          <p>{standalone ? copy.install.installed : copy.install.lead}</p>
        </div>
      </section>

      {standalone ? null : (
        <>
          <section className="t t-in-ios" aria-labelledby="in-ios-h">
            <h2 id="in-ios-h">{copy.install.iphone.heading}</h2>
            <ol aria-label={copy.a11y.install.stepList} className="in-steps">
              {IPHONE_STEPS.map(([title, sub], i) => (
                <li key={title}>
                  <span className="in-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>
                    <b>{title}</b>
                    <br />
                    <span className="in-sub">{sub}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="t t--half t-in-android" aria-labelledby="in-and-h">
            <h2 id="in-and-h">{copy.install.android.heading}</h2>
            <span>{copy.install.android.body}</span>
            {canPrompt ? (
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
                {copy.install.android.installButton}
              </button>
            ) : null}
          </section>

          <section className="t t--half t-in-why" aria-labelledby="in-why-h">
            <h2 id="in-why-h">{copy.install.why.heading}</h2>
            <span>{copy.install.why.body}</span>
          </section>
        </>
      )}

      <section className="t t-in-actions">
        <Link href="/today" className="in-done">
          {standalone ? copy.locked.backToToday : copy.install.done}
        </Link>
        {standalone ? null : (
          <Link href="/today" className="in-later" aria-label={copy.a11y.install.later}>
            {copy.install.later}
          </Link>
        )}
      </section>
    </>
  );
}
