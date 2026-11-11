"use client";

import { useId, useRef, useState, useTransition } from "react";
import { copy } from "@/content/copy.he";
import { AlertCircle, CheckIcon } from "../_components/icons";
import { setWhatsappRemindersAction } from "./actions";

/**
 * "תזכורת בוואטסאפ": מתג (role="switch", aria-checked) שנשמר בשרת לכל משתמש. ברירת מחדל: פעיל.
 * המצב מתעדכן רק אחרי שהשרת אישר; כשל מוצג באזור role="status" אחד, והמתג נשאר במצבו הקודם.
 */
export function WhatsappToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const titleId = useId();
  const statusId = useId();

  function onToggle() {
    if (busy.current) return;
    busy.current = true;
    const to = !on;
    startTransition(async () => {
      let ok = false;
      try {
        const r = await setWhatsappRemindersAction(to);
        if (r.ok) {
          setOn(r.on);
          ok = true;
        }
      } catch {
        ok = false;
      }
      setFailed(!ok);
      busy.current = false;
    });
  }

  return (
    <section className="t t-rem-set">
      <div className="rm-row">
        <span className="rm-row-text">
          <b id={titleId}>{copy.reminders.whatsappTitle}</b>
        </span>
        <button
          type="button"
          role="switch"
          className="rm-switch"
          aria-checked={on}
          aria-labelledby={titleId}
          aria-describedby={statusId}
          aria-busy={pending}
          onClick={onToggle}
        >
          <span className={`rm-track${on ? " rm-track--on" : ""}`}>
            <i className="rm-knob">{on ? <CheckIcon size={12} /> : null}</i>
          </span>
        </button>
      </div>
      <p id={statusId} className={`rm-status${failed ? " rm-status--bad" : ""}`} role="status" aria-live="polite">
        {failed ? (
          <>
            <AlertCircle />
            <span>{copy.login.errors.generic}</span>
          </>
        ) : null}
      </p>
    </section>
  );
}
