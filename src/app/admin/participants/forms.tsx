"use client";

import { useActionState, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import {
  addParticipantAction,
  deleteParticipantAction,
  newLinkAction,
  setDisabledAction,
  startPreviewAction,
} from "./actions";
import { IDLE, type AdminState } from "./state";

const P = copy.admin.participants;

function Status({ state }: { state: AdminState }) {
  // אזור ה־status קיים תמיד (ריק במנוחה), כדי שקוראי מסך יקריאו את ההודעה כשהיא מופיעה; שגיאה היא alert.
  // הקישור עצמו בפאנל נפרד.
  return (
    <>
      <p className="adm-msg" role="status">
        {state.status === "done" ? state.message : null}
      </p>
      {state.status === "error" ? (
        <p className="adm-msg adm-msg--err" role="alert">
          {P.errors[state.error]}
        </p>
      ) : null}
    </>
  );
}

/**
 * בזמן שליחה הכפתור מסומן aria-disabled ולא disabled: כפתור שנעשה disabled מאבד את הפוקוס (הוא עובר ל־body), וקורא
 * המסך מאבד את המקום. שליחה כפולה נחסמת כאן.
 */
const blockWhile = (pending: boolean) => (e: FormEvent) => {
  if (pending) e.preventDefault();
};

/** הודעה שמקבלת את הפוקוס כשהיא מופיעה (למשל אחרי מחיקה, כשהכפתור שנלחץ כבר לא קיים). */
export function FocusOnMount({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <p ref={ref} tabIndex={-1} className={className} role="status">
      {children}
    </p>
  );
}

/** הקישור החד־פעמי, עם הערה וכפתור העתקה. קיים רק בזיכרון הטופס: רענון הדף מעלים אותו. */
function LinkPanel({ state }: { state: Extract<AdminState, { status: "link" }> }) {
  const [note, setNote] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  // הפאנל מופיע אחרי הפעולה: הפוקוס עובר לשדה הקישור (שמסומן כולו), והתיאור שלו מוקרא איתו.
  useEffect(() => input.current?.focus(), [state.link]);
  const intro = fill(state.purpose === "reset" ? P.link.forReset : P.link.forActivate, {
    name: state.name || state.username,
    username: state.username,
    until: state.until,
  });
  async function onCopy() {
    setNote(""); // לחיצה חוזרת: ההודעה מתחלפת, ולכן מוקראת שוב
    try {
      await navigator.clipboard.writeText(state.link);
      setNote(P.link.copied);
    } catch {
      setNote(P.link.copyFailed);
    }
  }
  return (
    <div className="adm-link" data-testid="one-time-link">
      <p id={`${id}-intro`}>{intro}</p>
      <label>
        {P.link.label}
        <input
          ref={input}
          className="adm-link-input"
          readOnly
          value={state.link}
          dir="ltr"
          aria-describedby={`${id}-intro ${id}-once`}
          onFocus={(e) => e.currentTarget.select()}
        />
      </label>
      <button type="button" className="adm-btn" onClick={onCopy}>
        {P.link.copy}
      </button>
      <p className="adm-msg" role="status">
        {note}
      </p>
      <p className="adm-note" id={`${id}-once`}>
        {P.link.showOnce}
      </p>
    </div>
  );
}

export function AddForm() {
  const [state, action, pending] = useActionState(addParticipantAction, IDLE);
  return (
    <form action={action} onSubmit={blockWhile(pending)} className="adm-form" autoComplete="off">
      <label>
        {P.add.name}
        <input name="name" required maxLength={80} />
      </label>
      <label>
        {P.add.phone}
        <input name="phone" type="tel" inputMode="tel" dir="ltr" maxLength={40} />
      </label>
      <label>
        {P.add.email}
        <input name="email" type="email" dir="ltr" maxLength={254} />
      </label>
      <button className="adm-btn adm-btn--primary" aria-disabled={pending || undefined}>
        {P.add.submit}
      </button>
      <Status state={state} />
      {state.status === "link" ? <LinkPanel state={state} /> : null}
    </form>
  );
}

export function NewLinkForm({ id, name, activated }: { id: string; name: string; activated: boolean }) {
  const [state, action, pending] = useActionState(newLinkAction, IDLE);
  return (
    <form action={action} onSubmit={blockWhile(pending)}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="name" value={name} />
      <button className="adm-btn" aria-disabled={pending || undefined} aria-label={fill(activated ? P.link.issueResetFor : P.link.issueActivateFor, { name })}>
        {activated ? P.link.issueReset : P.link.issueActivate}
      </button>
      <Status state={state} />
      {state.status === "link" ? <LinkPanel state={state} /> : null}
    </form>
  );
}

export function DisableForm({ id, name, disabled }: { id: string; name: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(setDisabledAction, IDLE);
  return (
    <form action={action} onSubmit={blockWhile(pending)}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="disable" value={disabled ? "0" : "1"} />
      <button className="adm-btn" aria-disabled={pending || undefined} aria-label={fill(disabled ? P.disable.enableFor : P.disable.buttonFor, { name })}>
        {disabled ? P.disable.enable : P.disable.button}
      </button>
      <Status state={state} />
    </form>
  );
}

export function DeleteForm({ id, name, username }: { id: string; name: string; username: string }) {
  const [state, action, pending] = useActionState(deleteParticipantAction, IDLE);
  const warnId = useId();
  return (
    <form action={action} onSubmit={blockWhile(pending)} className="adm-form">
      <input type="hidden" name="id" value={id} />
      <p id={warnId}>{fill(P.remove.warning, { name, username })}</p>
      <label>
        {P.remove.confirmLabel}
        {/* the confirmation step appears after a navigation: focus goes straight to it, with the warning read out */}
        <input name="confirm" required dir="ltr" autoComplete="off" autoFocus aria-describedby={warnId} />
      </label>
      <button className="adm-btn adm-btn--danger" aria-disabled={pending || undefined}>
        {P.remove.submit}
      </button>
      <Status state={state} />
    </form>
  );
}

export function PreviewForm({ current }: { current: number | null }) {
  const [state, action, pending] = useActionState(startPreviewAction, IDLE);
  return (
    <form action={action} onSubmit={blockWhile(pending)} className="adm-form">
      <label htmlFor="adm-preview-day">{P.preview.dayLabel}</label>
      <div>
        <select id="adm-preview-day" name="day" defaultValue={current ?? 1}>
          {Array.from({ length: 14 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </div>
      <button className="adm-btn adm-btn--primary" aria-disabled={pending || undefined}>
        {P.preview.start}
      </button>
      <Status state={state} />
    </form>
  );
}
