"use client";

import { useId, useState, type Ref } from "react";
import { AlertIcon, EyeIcon, EyeOffIcon } from "./icons";

type Props = {
  name: string;
  label: string;
  toggleLabel: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
  /** מזהים נוספים (רשימת דרישות וכד') שמצורפים ל־aria-describedby. */
  describedBy?: string;
  value?: string;
  onChange?: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  maxLength?: number;
};

/** שדה סיסמה עם כפתור הצגה (44×44, aria-pressed). התווית הנגישה של הכפתור קבועה, והמצב ב־aria-pressed. */
export function PasswordField({
  name,
  label,
  toggleLabel,
  autoComplete,
  error,
  describedBy: extraDescribedBy,
  value,
  onChange,
  inputRef,
  maxLength,
}: Props) {
  const id = useId();
  const errId = `${id}-err`;
  const [shown, setShown] = useState(false);
  const describedBy = [extraDescribedBy, error ? errId : undefined].filter(Boolean).join(" ");
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input
          id={id}
          ref={inputRef}
          className="input input--with-icon"
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...(onChange ? { value: value ?? "", onChange: (e) => onChange(e.target.value) } : {})}
        />
        <button
          type="button"
          className="toggle"
          aria-label={toggleLabel}
          aria-pressed={shown}
          aria-controls={id}
          onClick={() => setShown((s) => !s)}
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error ? (
        <p id={errId} className="error">
          <AlertIcon />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
