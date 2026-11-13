"use client";

import { useActionState, useId } from "react";
import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import { formatMinutes, reminderChoices } from "@/lib/days/reminder";
import { AlertCircle, CheckIcon } from "../_components/icons";
import { setReminderTimeAction, type ReminderTimeState } from "./actions";

const CHOICES = reminderChoices();

/**
 * שעת התזכורת היומית: select עם תווית ושמירה בכפתור (server action דרך טופס, עובד גם בלי JS).
 * שעה אחת לשני הערוצים. התוצאה (נשמר / שגיאה) באזור role="status" (polite) שתמיד קיים ב־DOM, כדי שתוכרז.
 */
export function ReminderTimeForm({ initialMinutes, unlockTime, reminderTime }: { initialMinutes: number; unlockTime: string; reminderTime: string }) {
  const [state, formAction, pending] = useActionState<ReminderTimeState, FormData>(setReminderTimeAction, { status: "idle" });
  const selectId = useId();
  const noteId = useId();
  const statusId = useId();
  const current = state.status === "saved" ? state.minutes : initialMinutes;

  return (
    <form action={formAction} className="rm-row rm-row--time rm-row--form">
      <label htmlFor={selectId} className="rm-row-text">
        <b>{copy.reminders.timeLabel}</b>
      </label>
      <span id={noteId} className="rm-sub">
        {fill(copy.reminders.timeNote, { unlockTime, reminderTime })}
      </span>
      <div className="rm-time-controls">
        {/* key: אחרי שמירה ה־select נשאר על הערך השמור (uncontrolled עם defaultValue) */}
        <select
          id={selectId}
          name="reminderTime"
          className="rm-select"
          dir="ltr"
          defaultValue={String(current)}
          key={current}
          aria-describedby={`${noteId} ${statusId}`}
        >
          {CHOICES.map((m) => (
            <option key={m} value={m}>
              {formatMinutes(m)}
            </option>
          ))}
        </select>
        <button type="submit" className="rm-save" disabled={pending} aria-busy={pending}>
          {copy.reminders.timeSave}
        </button>
      </div>
      <p
        id={statusId}
        className={`rm-time-status${state.status === "error" ? " rm-time-status--bad" : ""}`}
        role="status"
        aria-live="polite"
      >
        {state.status === "saved" ? (
          <>
            <CheckIcon size={16} />
            <span>{copy.reminders.timeSaved}</span>
          </>
        ) : state.status === "error" ? (
          <>
            <AlertCircle />
            <span>{copy.reminders.timeError}</span>
          </>
        ) : null}
      </p>
    </form>
  );
}
