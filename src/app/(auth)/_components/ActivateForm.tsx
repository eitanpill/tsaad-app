"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { copy } from "@/content/copy.he";
import { passwordRequirements } from "@/lib/auth/policy";
import { activateAction } from "../actions";
import type { ActivateState } from "../state";
import { ExpiredLink } from "./ExpiredLink";
import { CheckDiscIcon, LockIcon, RingIcon } from "./icons";
import { PasswordField } from "./PasswordField";

export function ActivateForm({ token, username }: { token: string; username: string }) {
  const [state, action, pending] = useActionState<ActivateState, FormData>(activateAction, {});
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const req = passwordRequirements(password);

  useEffect(() => {
    if (state.error?.field === "password") passwordRef.current?.focus();
    else if (state.error?.field === "confirm") confirmRef.current?.focus();
  }, [state]);

  if (state.status === "expired") return <ExpiredLink />;

  const msg = (field: "password" | "confirm" | "form") =>
    state.error?.field === field
      ? copy.activate.errors[state.error.code]
      : undefined;

  const items = [
    { key: "minLength", text: copy.activate.password.minLength, done: req.minLength },
    { key: "digit", text: copy.activate.password.digit, done: req.digit },
  ];

  return (
    <form action={action} noValidate className="form" aria-label={copy.activate.title}>
      <input type="hidden" name="token" value={token} />

      <div className="field">
        <label htmlFor="activate-username">{copy.activate.username.label}</label>
        <div className="input-wrap">
          <input
            id="activate-username"
            className="input input--with-icon input--readonly"
            name="username"
            type="text"
            value={username}
            readOnly
            autoComplete="username"
            dir="ltr"
            aria-describedby="activate-username-hint"
          />
          <span className="input-icon">
            <LockIcon />
          </span>
        </div>
        <p id="activate-username-hint" className="hint">
          {copy.activate.username.hint}
        </p>
      </div>

      <PasswordField
        name="password"
        label={copy.activate.password.label}
        toggleLabel={copy.a11y.forms.showPassword}
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        inputRef={passwordRef}
        error={msg("password")}
        describedBy="activate-requirements"
      />
      <ul
        id="activate-requirements"
        className="requirements"
        aria-label={copy.activate.password.requirementsTitle}
        style={{ marginTop: -8 }}
      >
        {items.map((i) => (
          <li key={i.key}>
            {i.done ? <CheckDiscIcon /> : <RingIcon />}
            <span>
              {i.text}
              <span className="visually-hidden">
                {i.done ? copy.a11y.forms.requirementDone : copy.a11y.forms.requirementPending}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <PasswordField
        name="confirm"
        label={copy.activate.confirm.label}
        toggleLabel={copy.a11y.forms.showConfirmPassword}
        autoComplete="new-password"
        value={confirm}
        onChange={setConfirm}
        inputRef={confirmRef}
        error={msg("confirm")}
      />

      {msg("form") ? (
        <p role="alert" className="error">
          {msg("form")}
        </p>
      ) : null}

      <button type="submit" className="btn" disabled={pending}>
        {pending ? copy.activate.submitting : copy.activate.submit}
      </button>
    </form>
  );
}
