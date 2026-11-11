"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { copy } from "@/content/copy.he";
import { AlertCircle } from "../_components/icons";
import { deleteAccountAction } from "./actions";
import type { DeleteState } from "./state";

const D = copy.account.delete;

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccountAction, {});
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const message = state.error ? D.errors[state.error] : undefined;

  useEffect(() => {
    if (state.error) input.current?.focus();
  }, [state]);

  return (
    <form action={action} noValidate className="acc-form" aria-labelledby="acc-del-h">
      <div className="acc-field">
        <label htmlFor={id}>{D.passwordLabel}</label>
        <input
          ref={input}
          id={id}
          name="password"
          type="password"
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
          maxLength={128}
          aria-describedby={[`${id}-hint`, message ? `${id}-err` : null].filter(Boolean).join(" ")}
          aria-invalid={message ? true : undefined}
        />
        <p id={`${id}-hint`} className="acc-hint">
          {D.passwordHint}
        </p>
        {message ? (
          <p id={`${id}-err`} role="alert" className="acc-error">
            <AlertCircle />
            <span>{message}</span>
          </p>
        ) : null}
      </div>
      <button type="submit" className="acc-danger" aria-busy={pending} disabled={pending}>
        {pending ? D.busy : D.submit}
      </button>
    </form>
  );
}
