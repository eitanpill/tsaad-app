"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import { forgotAction } from "../actions";
import type { ForgotState } from "../state";
import { FocusHeading } from "./FocusHeading";
import { AlertIcon, MailIcon } from "./icons";

export function ForgotForm({ cooldownSeconds }: { cooldownSeconds: number }) {
  const [state, action, pending] = useActionState<ForgotState, FormData>(forgotAction, {});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.error) inputRef.current?.focus();
  }, [state]);

  const error = state.error ? copy.forgot.errors[state.error] : undefined;

  return (
    <>
      <section className="tile tile--white" aria-label={copy.forgot.title}>
        <form action={action} noValidate className="form">
          <div className="field">
            <label htmlFor="identifier">{copy.forgot.field.label}</label>
            <input
              id="identifier"
              ref={inputRef}
              className="input"
              name="identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={254}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "identifier-hint identifier-err" : "identifier-hint"}
            />
            <p id="identifier-hint" className="hint">
              {copy.forgot.field.hint}
            </p>
            {error ? (
              <p id="identifier-err" role="alert" className="error">
                <AlertIcon />
                <span>{error}</span>
              </p>
            ) : null}
          </div>
          <button type="submit" className="btn" disabled={pending}>
            {pending ? copy.forgot.submitting : copy.forgot.submit}
          </button>
          <Link href="/login" className="link center">
            {copy.forgot.backToLogin}
          </Link>
        </form>
      </section>

      {state.status === "sent" ? (
        <section className="tile tile--sage" role="status">
          <div className="note-row">
            <span className="note-icon">
              <MailIcon />
            </span>
            <div>
              <FocusHeading className="note-title">{copy.forgot.confirmation.heading}</FocusHeading>
              <p className="note-body">{copy.forgot.confirmation.body}</p>
              <ResendControls
                key={state.sentAt}
                action={action}
                pending={pending}
                identifier={state.identifier ?? ""}
                cooldownSeconds={cooldownSeconds}
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className="tile tile--sand" aria-labelledby="forgot-username-title">
        <h2 id="forgot-username-title" className="note-title">
          {copy.forgot.forgotUsername.heading}
        </h2>
        <p className="note-body">{copy.forgot.forgotUsername.body}</p>
      </section>
    </>
  );
}

/** כפתור "שליחה מחדש" עם ספירה לאחור (טקסט, לא רק צבע). הגבלת הקצב האמיתית נאכפת בשרת. */
function ResendControls({
  action,
  pending,
  identifier,
  cooldownSeconds,
}: {
  action: (payload: FormData) => void;
  pending: boolean;
  identifier: string;
  cooldownSeconds: number;
}) {
  const [left, setLeft] = useState(cooldownSeconds);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <form action={action} noValidate>
        <input type="hidden" name="identifier" value={identifier} />
        <button type="submit" className="link" disabled={left > 0 || pending}>
          {copy.forgot.confirmation.resend}
        </button>
      </form>
      {left > 0 ? (
        <p className="hint" style={{ color: "inherit" }}>
          {fill(copy.forgot.confirmation.resendWait, { seconds: left })}
        </p>
      ) : null}
    </>
  );
}
