"use client";

import { useActionState, useState } from "react";
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
  // role=status: הודעות הצלחה ושגיאה מוקראות. הקישור עצמו בפאנל נפרד.
  if (state.status === "error") return <p className="adm-msg adm-msg--err" role="alert">{P.errors[state.error]}</p>;
  if (state.status === "done") return <p className="adm-msg" role="status">{state.message}</p>;
  return null;
}

/** הקישור החד־פעמי, עם הערה וכפתור העתקה. קיים רק בזיכרון הטופס: רענון הדף מעלים אותו. */
function LinkPanel({ state }: { state: Extract<AdminState, { status: "link" }> }) {
  const [note, setNote] = useState("");
  const intro = fill(state.purpose === "reset" ? P.link.forReset : P.link.forActivate, {
    name: state.name || state.username,
    username: state.username,
    until: state.until,
  });
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(state.link);
      setNote(P.link.copied);
    } catch {
      setNote(P.link.copyFailed);
    }
  }
  return (
    <div className="adm-link" data-testid="one-time-link">
      <p>{intro}</p>
      <label>
        {P.link.label}
        <input className="adm-link-input" readOnly value={state.link} dir="ltr" onFocus={(e) => e.currentTarget.select()} />
      </label>
      <button type="button" className="adm-btn" onClick={onCopy}>
        {P.link.copy}
      </button>
      <p className="adm-msg" role="status">
        {note}
      </p>
      <p className="adm-note">{P.link.showOnce}</p>
    </div>
  );
}

export function AddForm() {
  const [state, action, pending] = useActionState(addParticipantAction, IDLE);
  return (
    <form action={action} className="adm-form" autoComplete="off">
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
      <button className="adm-btn adm-btn--primary" disabled={pending}>
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
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="name" value={name} />
      <button className="adm-btn" disabled={pending} aria-label={fill(activated ? P.link.issueResetFor : P.link.issueActivateFor, { name })}>
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
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="disable" value={disabled ? "0" : "1"} />
      <button className="adm-btn" disabled={pending} aria-label={fill(disabled ? P.disable.enableFor : P.disable.buttonFor, { name })}>
        {disabled ? P.disable.enable : P.disable.button}
      </button>
      <Status state={state} />
    </form>
  );
}

export function DeleteForm({ id, name, username }: { id: string; name: string; username: string }) {
  const [state, action, pending] = useActionState(deleteParticipantAction, IDLE);
  return (
    <form action={action} className="adm-form">
      <input type="hidden" name="id" value={id} />
      <p>{fill(P.remove.warning, { name, username })}</p>
      <label>
        {P.remove.confirmLabel}
        <input name="confirm" required dir="ltr" autoComplete="off" />
      </label>
      <button className="adm-btn adm-btn--danger" disabled={pending}>
        {P.remove.submit}
      </button>
      <Status state={state} />
    </form>
  );
}

export function PreviewForm({ current }: { current: number | null }) {
  const [state, action, pending] = useActionState(startPreviewAction, IDLE);
  return (
    <form action={action} className="adm-form">
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
      <button className="adm-btn adm-btn--primary" disabled={pending}>
        {P.preview.start}
      </button>
      <Status state={state} />
    </form>
  );
}
