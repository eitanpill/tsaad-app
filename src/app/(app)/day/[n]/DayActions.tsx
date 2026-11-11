"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { copy } from "@/content/copy.he";
import { actionsForDay, type Action } from "@/lib/days";
import { actionKey } from "@/lib/today/view";
import { ToastDock } from "../../_components/ToastDock";
import { toggleAction } from "../../today/actions";
import { actionDetail, actionTitle, type DayTitles } from "../../today/action-labels";
import { ActionButton } from "../../today/ActionButton";

type Toast = { kind: "saved" | "undone"; text: string } | { kind: "error"; text: string; retry: { action: Action; to: boolean } };

/**
 * הפעולות של יום קודם שעוד אפשר לסמן (אתמול, עד חצות). הכלל נאכף בשרת (toggleAction); כאן רק הממשק.
 * מקבל רק את הכותרות של היום הזה, כדי שתוכן של ימים אחרים לא יגיע ללקוח.
 */
export function DayActions({ day, titles, done }: { day: number; titles: DayTitles; done: Action[] }) {
  const initial = useMemo(() => done.map((a) => actionKey(day, a)), [done, day]);
  const [saved, setSaved] = useState<string[]>(initial);
  const [optimistic, applyOptimistic] = useOptimistic(
    saved,
    (cur: string[], patch: { key: string; done: boolean }) =>
      patch.done ? (cur.includes(patch.key) ? cur : [...cur, patch.key]) : cur.filter((k) => k !== patch.key),
  );
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<Toast | null>(null);

  function setAction(action: Action, to: boolean) {
    const key = actionKey(day, action);
    startTransition(async () => {
      applyOptimistic({ key, done: to });
      let ok = false;
      try {
        const res = await toggleAction(day, action, to);
        ok = res.ok;
        if (res.ok) setSaved((cur) => (to ? (cur.includes(key) ? cur : [...cur, key]) : cur.filter((k) => k !== key)));
      } catch {
        ok = false;
      }
      if (!ok) setToast({ kind: "error", text: copy.states.saveFailed, retry: { action, to } });
      else setToast(to ? { kind: "saved", text: copy.states.success.saved } : { kind: "undone", text: copy.states.success.undone });
    });
  }

  const focusAction = (a: Action) =>
    document.querySelector<HTMLButtonElement>(`[data-action-key="${actionKey(day, a)}"]`)?.focus();

  return (
    <>
      <div className="act-grid">
        {actionsForDay(day).map((a, i) => (
          <ActionButton
            key={a}
            day={day}
            action={a}
            title={actionTitle(titles, a)}
            detail={actionDetail(titles, a)}
            pressed={optimistic.includes(actionKey(day, a))}
            wide={i === 0 || a === "live"}
            onToggle={(_, action) => setAction(action, !optimistic.includes(actionKey(day, action)))}
          />
        ))}
      </div>
      <ToastDock
        source={toast}
        onExpire={() => setToast(null)}
        toast={
          !toast
            ? null
            : toast.kind === "error"
              ? {
                  error: true,
                  text: toast.text,
                  action: {
                    label: copy.common.retry,
                    run: () => {
                      const r = toast.retry;
                      setToast(null);
                      focusAction(r.action);
                      setAction(r.action, r.to);
                    },
                  },
                }
              : { text: toast.text }
        }
      />
    </>
  );
}
