"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { copy } from "@/content/copy.he";
import { loginAction } from "../actions";
import type { LoginState } from "../state";
import { AlertIcon } from "./icons";
import { PasswordField } from "./PasswordField";

const FIELD_ERRORS = { usernameRequired: copy.login.errors.usernameRequired, passwordRequired: copy.login.errors.passwordRequired } as const;

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // שגיאה: הפוקוס עובר לשדה הראשון הבעייתי (שם המשתמש, וכשרק הסיסמה חסרה, הסיסמה).
  useEffect(() => {
    if (!state.error) return;
    (state.error === "passwordRequired" ? passwordRef : usernameRef).current?.focus();
  }, [state]);

  const usernameError = state.error === "usernameRequired" ? FIELD_ERRORS.usernameRequired : undefined;
  const passwordError = state.error === "passwordRequired" ? FIELD_ERRORS.passwordRequired : undefined;
  const formError =
    state.error === "invalid" || state.error === "tooMany" || state.error === "generic"
      ? copy.login.errors[state.error]
      : undefined;

  return (
    <form action={action} noValidate aria-labelledby="login-form-title" className="form">
      <h2 id="login-form-title" className="visually-hidden">
        {copy.a11y.forms.loginTitle}
      </h2>

      <div className="field">
        <label htmlFor="username">{copy.login.username.label}</label>
        <input
          id="username"
          ref={usernameRef}
          className="input"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
          defaultValue={state.username ?? ""}
          aria-invalid={usernameError || formError ? true : undefined}
          aria-describedby={
            usernameError ? "username-err" : formError ? "login-form-err" : undefined
          }
        />
        {usernameError ? (
          <p id="username-err" className="error">
            <AlertIcon />
            <span>{usernameError}</span>
          </p>
        ) : null}
      </div>

      <PasswordField
        name="password"
        label={copy.login.password.label}
        toggleLabel={copy.a11y.forms.showPassword}
        autoComplete="current-password"
        error={passwordError}
        inputRef={passwordRef}
      />

      {formError ? (
        <p id="login-form-err" role="alert" className="error">
          <AlertIcon />
          <span>
            {formError}
            {state.error === "tooMany" ? (
              <>
                {" "}
                {copy.login.errors.tooManyReset}{" "}
                <Link href="/forgot" className="link">
                  {copy.login.forgot}
                </Link>
                .
              </>
            ) : null}
          </span>
        </p>
      ) : null}

      <button type="submit" className="btn" disabled={pending}>
        {pending ? copy.login.submitting : copy.login.submit}
      </button>
      <Link href="/forgot" className="link center">
        {copy.login.forgot}
      </Link>
    </form>
  );
}
