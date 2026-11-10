"use client";

import { useRef, useState, useTransition } from "react";
import { copy } from "@/content/copy.he";
import { toggleAction } from "../today/actions";
import { CheckIcon } from "../_components/icons";

/**
 * "הייתי במפגש": סימון לא חובה, באותו מנגנון של מסך היום (toggleAction עם הפעולה live). השרת קובע אם היום פתוח
 * לסימון ומה הכלל (לייב נספר כשני צעדים בכוס). הלקוח רק מציג את התוצאה, גם כשהיא שלילית.
 */
export function AttendanceToggle({ day, initial }: { day: 7 | 14; initial: boolean }) {
  const [pressed, setPressed] = useState(initial);
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);

  function onClick() {
    if (busy.current) return;
    busy.current = true;
    const to = !pressed;
    startTransition(async () => {
      let ok = false;
      try {
        const res = await toggleAction(day, "live", to);
        ok = res.ok;
        if (res.ok) setPressed(res.done);
      } catch {
        ok = false;
      }
      setMsg(ok ? (to ? copy.states.success.saved : copy.states.success.undone) : copy.states.saveFailed);
      busy.current = false;
    });
  }

  return (
    <div className="lv-attend">
      <button
        type="button"
        className="act act--wide lv-attend-btn"
        aria-pressed={pressed}
        aria-label={copy.a11y.live.attended}
        aria-busy={pending}
        onClick={onClick}
      >
        <b>{copy.live.attendedLabel}</b>
        <span className="act-sub">{copy.live.attendedHint}</span>
        <span className="dot" aria-hidden="true">
          {pressed ? <CheckIcon /> : null}
        </span>
      </button>
      <p className="lv-attend-msg" role="status" aria-live="polite">
        {msg}
      </p>
    </div>
  );
}
