"use client";

import { copy } from "@/content/copy.he";
import type { Action } from "@/lib/days";
import { actionKey } from "@/lib/today/view";
import { TYPE_LABEL } from "./action-labels";
import { CheckIcon } from "../_components/icons";

/** כפתור פעולה (מתג): aria-pressed, עם שם הסוג והכותרת. משותף למסך היום ולמסך יום קודם. */
export function ActionButton({
  day,
  action,
  title,
  detail,
  pressed,
  wide,
  onToggle,
}: {
  day: number;
  action: Action;
  title: string;
  detail?: string;
  pressed: boolean;
  wide?: boolean;
  onToggle: (day: number, action: Action) => void;
}) {
  const isLive = action === "live";
  return (
    <button
      type="button"
      className={`act${wide ? " act--wide" : ""}`}
      data-action-key={actionKey(day, action)}
      aria-pressed={pressed}
      onClick={() => onToggle(day, action)}
    >
      <b>{TYPE_LABEL(action)}</b>
      {isLive ? (
        <span className="act-sub">{copy.today.liveActionHint}</span>
      ) : (
        <span className="act-text">
          {title}
          {detail ? <small className="act-detail">{detail}</small> : null}
        </span>
      )}
      <span className="dot" aria-hidden="true">
        {pressed ? <CheckIcon /> : null}
      </span>
    </button>
  );
}
