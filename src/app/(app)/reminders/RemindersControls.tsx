"use client";

import Link from "next/link";
import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { copy } from "@/content/copy.he";
import { isStandalone } from "@/lib/pwa/install-prompt";
import { detectStatus, disableReminders, enableReminders, type ReminderStatus } from "@/lib/pwa/push-client";
import { AlertCircle, CheckIcon } from "../_components/icons";

const noopSubscribe = () => () => undefined;

/**
 * מתג ההתראות, מקום לטופס שעת התזכורת והערת האייפון. המצב נקבע בדפדפן:
 *  unsupported (אין תמיכה, או אין מפתח VAPID מהשרת), blocked (הרשאה נדחתה), off, on, error (נכשל, אפשר לנסות שוב).
 * המתג הוא role="switch" עם aria-checked; כשאי אפשר להפעיל הוא aria-disabled (נשאר בפוקוס, והסיבה כתובה לידו).
 * הודעת המצב נמצאת באזור role="status" (polite) אחד.
 */
export function RemindersControls({
  vapidKey,
  timeSlot,
}: {
  vapidKey: string | null;
  /** טופס שעת התזכורת (ReminderTimeForm), שמוצג בתוך אותה קבוצה. */
  timeSlot?: ReactNode;
}) {
  const [status, setStatus] = useState<ReminderStatus>("checking");
  // ההתראות פעילות בפועל (מנוי קיים). נפרד מהודעת המצב: כיבוי שנכשל משאיר on, והשגיאה מוצגת לידו.
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const subId = useId();
  const statusId = useId();
  const standalone = useSyncExternalStore(noopSubscribe, isStandalone, () => false);

  useEffect(() => {
    let alive = true;
    detectStatus(vapidKey).then((s) => {
      if (!alive) return;
      setStatus(s);
      setOn(s === "on");
    });
    return () => {
      alive = false;
    };
  }, [vapidKey]);

  const disabled = busy || status === "checking" || status === "unsupported" || status === "blocked";

  async function onToggle() {
    if (disabled || !vapidKey) return;
    setBusy(true);
    if (on) {
      const r = await disableReminders();
      setStatus(r);
      if (r === "off") setOn(false);
    } else {
      const r = await enableReminders(vapidKey);
      setStatus(r);
      setOn(r === "on");
    }
    setBusy(false);
  }

  const message =
    status === "checking" ? "" : copy.reminders.status[status];
  const bad = status === "blocked" || status === "unsupported" || status === "error";

  return (
    <>
      <section className="t t-rem-set">
        <div className="rm-row">
          <span className="rm-row-text">
            <b id={titleId}>{copy.reminders.toggleTitle}</b>
            <br />
            <span id={subId} className="rm-sub">
              {copy.reminders.toggleSub}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            className="rm-switch"
            aria-checked={on}
            aria-disabled={disabled}
            aria-labelledby={titleId}
            aria-describedby={`${subId} ${statusId}`}
            aria-busy={busy}
            onClick={onToggle}
          >
            <span className={`rm-track${on ? " rm-track--on" : ""}`}>
              <i className="rm-knob">{on ? <CheckIcon size={12} /> : null}</i>
            </span>
          </button>
        </div>
        <p id={statusId} className={`rm-status${bad ? " rm-status--bad" : ""}`} role="status" aria-live="polite">
          {message ? (
            <>
              {bad ? <AlertCircle /> : status === "on" ? <CheckIcon size={16} /> : null}
              <span>{message}</span>
            </>
          ) : null}
        </p>
        {timeSlot}
      </section>

      {standalone ? null : (
        <section className="t t-rem-ios">
          <span className="rm-i" aria-hidden="true">
            i
          </span>
          <span>
            {copy.reminders.iosNote}{" "}
            <Link href="/install" className="rm-link">
              {copy.reminders.installLink}
            </Link>
          </span>
        </section>
      )}
    </>
  );
}
