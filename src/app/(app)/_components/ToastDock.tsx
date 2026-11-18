"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, CheckIcon } from "./icons";

export type ToastView = {
  error?: boolean;
  text: string;
  /** "ביטול" or "לנסות שוב": a button next to the message, outside the live region. */
  action?: { label: string; ariaLabel?: string; run: () => void };
};

/**
 * The confirmation toast of Today and the day screen. The polite live region (.toast-region) is always in the DOM and holds
 * only the message, so a screen reader announces the sentence alone and not the button text with it; the button sits next to
 * it, in the same pill. The toast stays at least 7 seconds and does not close while the pointer or the focus is inside it.
 */
export function ToastDock({
  toast,
  source,
  onExpire,
}: {
  toast: ToastView | null;
  /** The caller's toast state: a new value restarts the 7-second timer (the view object itself is rebuilt on every render). */
  source: unknown;
  onExpire: () => void;
}) {
  const hold = useRef(false);
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });
  useEffect(() => {
    if (!source) return;
    const t = setInterval(() => {
      if (!hold.current) expire.current();
    }, 7000);
    return () => clearInterval(t);
  }, [source]);

  return (
    <div
      className="toast-dock"
      onMouseEnter={() => (hold.current = true)}
      onMouseLeave={() => (hold.current = false)}
      onFocus={() => (hold.current = true)}
      onBlur={() => (hold.current = false)}
    >
      <div className={toast ? `toast${toast.error ? " toast--err" : ""}` : undefined}>
        <div className="toast-region" role="status" aria-live="polite">
          {toast ? (
            <>
              <span className="tick" aria-hidden="true">
                {toast.error ? <AlertCircle /> : <CheckIcon size={16} />}
              </span>
              <span className="msg">{toast.text}</span>
            </>
          ) : null}
        </div>
        {toast?.action ? (
          <button type="button" aria-label={toast.action.ariaLabel} onClick={toast.action.run}>
            {toast.action.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
