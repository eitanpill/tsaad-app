"use client";

import { useEffect, useId, useMemo, useOptimistic, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { copy } from "@/content/copy.he";
import { DAYS } from "@/content/days";
import {
  actionsForDay,
  computeProgress,
  cupLevel,
  stepsFor,
  type Action,
  type Schedule,
} from "@/lib/days";
import { fill } from "@/lib/format";
import { actionKey, doneActionsFor } from "@/lib/today/view";
import { AlertCircle, CheckIcon, WifiOffIcon } from "../_components/icons";
import { toggleAction } from "./actions";
import { Cup } from "./Cup";
import { Ring } from "./Ring";
import { VideoTile } from "./VideoTile";

export type BoardProps = {
  schedule: Schedule;
  nowIso: string;
  /** "יום:פעולה" לכל מה שסומן. */
  completions: string[];
  phase: "active" | "ended";
  day: number | null;
  live: boolean;
  yesterday: number | null;
  /** אתמול עוד לא סומן בטעינה: מציגים את ההזמנה לסמן. */
  showYesterday: boolean;
  greeting: string;
  hero: string;
  videoAvailable: boolean;
  /** הרגע הקרוב שבו המסך משתנה (ISO), או null. */
  nextChangeIso: string | null;
};

type Toast =
  | { kind: "saved" | "undone"; text: string; undo?: { day: number; action: Action; to: boolean } }
  | { kind: "error"; text: string; retry: { day: number; action: Action; to: boolean } };

const TYPE_LABEL = (a: Action): string => (a === "live" ? copy.today.liveAction : copy.common.actionTypes[a]);

function actionTitle(day: number, a: Action): string {
  const d = DAYS[day - 1];
  return a === "habit" ? d.habit.title : a === "move" ? d.movement.title : a === "meditate" ? d.meditation.title : "";
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

function ActionButton({
  day,
  action,
  pressed,
  wide,
  onToggle,
}: {
  day: number;
  action: Action;
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
      {isLive ? <span className="act-sub">{copy.today.liveActionHint}</span> : actionTitle(day, action)}
      <span className="dot" aria-hidden="true">
        {pressed ? <CheckIcon /> : null}
      </span>
    </button>
  );
}

export function TodayBoard(p: BoardProps) {
  const router = useRouter();
  const [saved, setSaved] = useState<string[]>(p.completions);
  const [optimistic, applyOptimistic] = useOptimistic(
    saved,
    (cur: string[], patch: { key: string; done: boolean }) =>
      patch.done ? (cur.includes(patch.key) ? cur : [...cur, patch.key]) : cur.filter((k) => k !== patch.key),
  );
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<Toast | null>(null);
  const [yesterdayOpen, setYesterdayOpen] = useState(false);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const yestId = useId();

  const now = useMemo(() => new Date(p.nowIso), [p.nowIso]);

  // המסך מתרענן מהשרת ברגע שמשהו בו משתנה (יום נפתח, או חלון סימון של אתמול נסגר).
  useEffect(() => {
    if (!p.nextChangeIso) return;
    const ms = new Date(p.nextChangeIso).getTime() - Date.now();
    if (ms <= 0 || ms > 2 ** 31 - 1) return;
    const t = setTimeout(() => router.refresh(), ms + 1000);
    return () => clearTimeout(t);
  }, [p.nextChangeIso, router]);

  // ההודעה נשארת לפחות 7 שניות, ולא נעלמת כשהעכבר או המיקוד בתוכה.
  const hold = useRef(false);
  useEffect(() => {
    if (!toast) return;
    const t = setInterval(() => {
      if (!hold.current) setToast(null);
    }, 7000);
    return () => clearInterval(t);
  }, [toast]);

  const stepsByDay = useMemo(() => {
    const out: Record<number, number> = {};
    for (let d = 1; d <= p.schedule.totalDays; d++) out[d] = stepsFor(d, doneActionsFor(optimistic, d));
    return out;
  }, [optimistic, p.schedule.totalDays]);

  const progress = computeProgress(stepsByDay, now, p.schedule);
  const todaySteps = p.day ? stepsByDay[p.day] : 0;
  const level = cupLevel(todaySteps);

  function setAction(day: number, action: Action, to: boolean) {
    const key = actionKey(day, action);
    const before = stepsByDay[day];
    startTransition(async () => {
      applyOptimistic({ key, done: to });
      let ok = false;
      try {
        const res = await toggleAction(day, action, to);
        ok = res.ok;
        if (res.ok) {
          setSaved((cur) => (to ? (cur.includes(key) ? cur : [...cur, key]) : cur.filter((k) => k !== key)));
        }
      } catch {
        ok = false;
      }
      if (!ok) {
        setToast({ kind: "error", text: copy.states.saveFailed, retry: { day, action, to } });
        return;
      }
      if (to) {
        setToast({
          kind: "saved",
          text: before === 0 ? copy.today.toastFirst : copy.states.success.saved,
          undo: { day, action, to: false },
        });
      } else {
        setToast({ kind: "undone", text: copy.states.success.undone });
      }
    });
  }

  // הכפתור בהודעה (ביטול / לנסות שוב) נעלם אחרי הלחיצה: המיקוד עובר לכפתור הפעולה עצמה, לא לגוף הדף.
  function focusAction(day: number, action: Action) {
    document.querySelector<HTMLButtonElement>(`[data-action-key="${actionKey(day, action)}"]`)?.focus();
  }

  // פתיחת "לסימון אתמול" מחליפה את הכפתור בקבוצת הפעולות: המיקוד עובר לפעולה הראשונה בקבוצה.
  const yestGroup = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (yesterdayOpen) yestGroup.current?.querySelector("button")?.focus();
  }, [yesterdayOpen]);

  const toggle = (day: number, action: Action) => setAction(day, action, !optimistic.includes(actionKey(day, action)));

  const stepsText = level === "empty" ? copy.today.cup.empty : level === "half" ? copy.today.cup.one : level === "three_quarters" ? copy.today.cup.two : copy.today.cup.three;
  const cupLabel = copy.a11y.cup[level === "empty" ? "empty" : level === "half" ? "one" : level === "three_quarters" ? "two" : "three"];

  const actions = p.day ? actionsForDay(p.day) : [];
  // בטבעת: "ימים נספרו" ושורת ספירה קצרה בלבד (עד 3 שורות, כמו בעיצוב). הודעה ארוכה עוברת לאריח משלה.
  // אחרי סוף האתגר אין "אפשר להמשיך": רק "האתגר הושלם" אם הושלם.
  const ended = p.phase === "ended";
  const countLine = progress.completed
    ? copy.today.remaining.done
    : ended || !progress.isCompletionReachable
      ? null
      : progress.remaining === 1
        ? copy.today.remaining.one
        : fill(copy.today.remaining.many, { remaining: progress.remaining });
  const longNote = ended
    ? null
    : progress.completed
      ? copy.today.afterCompletion
      : !progress.isCompletionReachable
        ? copy.today.remaining.unreachable
        : null;

  return (
    <>
      <div role="status" className={online ? "visually-hidden" : "offline"}>
        {online ? null : (
          <>
            <WifiOffIcon />
            <b>{copy.states.offline.heading}</b>
          </>
        )}
      </div>

      <section className="t t-hero" aria-labelledby="hero-h">
        <span className="eyebrow-s">{p.greeting}</span>
        <h1 id="hero-h">{p.hero}</h1>
      </section>

      {p.showYesterday && p.yesterday ? (
        <section className="t t-yest" aria-labelledby={`${yestId}-p`}>
          <p id={`${yestId}-p`}>{copy.today.yesterday.prompt}</p>
          {!yesterdayOpen ? (
            <button
              type="button"
              className="btn-s"
              aria-expanded={false}
              aria-controls={`${yestId}-g`}
              onClick={() => setYesterdayOpen(true)}
            >
              {copy.today.yesterday.action}
            </button>
          ) : (
            <div ref={yestGroup} id={`${yestId}-g`} className="grp" role="group" aria-label={fill(copy.today.yesterdayDayLabel, { n: p.yesterday })}>
              <span className="grp-label">{fill(copy.common.dayLabel, { n: p.yesterday })}</span>
              {actionsForDay(p.yesterday).map((a, i) => (
                <ActionButton key={a} day={p.yesterday!} action={a} pressed={optimistic.includes(actionKey(p.yesterday!, a))} onToggle={toggle} wide={i === 0 || a === "live"} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {p.day ? <VideoTile day={p.day} available={p.videoAvailable} /> : null}

      <section className={`t t-ring${p.phase === "active" ? " t--half" : ""}`} aria-label={copy.today.counted}>
        <Ring counted={progress.counted} />
        <span>
          {copy.today.counted}
          {countLine ? (
            <>
              <br />
              <b>{countLine}</b>
            </>
          ) : null}
        </span>
      </section>

      {p.phase === "active" ? (
        <section className="t t--half t-cup">
          <Cup level={level} label={cupLabel} />
          <span>
            {stepsText}
            <br />
            {level === "empty" ? <span>{copy.today.markHint}</span> : <b>{copy.today.counts}</b>}
          </span>
        </section>
      ) : null}

      {longNote ? (
        <section className="t t-note t-progress-note">
          <p>{longNote}</p>
        </section>
      ) : null}

      {p.day ? (
        <div className="t t-actions">
          <div className="act-grid">
            {actions.map((a, i) => (
              <ActionButton key={a} day={p.day!} action={a} pressed={optimistic.includes(actionKey(p.day!, a))} onToggle={toggle} wide={i === 0 || a === "live"} />
            ))}
          </div>
          <p className="act-hint">{p.live ? copy.today.cupExplainLive : copy.today.cupExplain}</p>
        </div>
      ) : null}

      <div
        className="toast-region"
        role="status"
        aria-live="polite"
        onMouseEnter={() => (hold.current = true)}
        onMouseLeave={() => (hold.current = false)}
        onFocus={() => (hold.current = true)}
        onBlur={() => (hold.current = false)}
      >
        {toast ? (
          <div className={`toast${toast.kind === "error" ? " toast--err" : ""}`}>
            <span className="tick" aria-hidden="true">
              {toast.kind === "error" ? <AlertCircle /> : <CheckIcon size={16} />}
            </span>
            <span className="msg">{toast.text}</span>
            {toast.kind === "error" ? (
              <button type="button" onClick={() => { const r = toast.retry; setToast(null); focusAction(r.day, r.action); setAction(r.day, r.action, r.to); }}>
                {copy.common.retry}
              </button>
            ) : toast.undo ? (
              <button
                type="button"
                aria-label={copy.a11y.toast.undo}
                onClick={() => { const u = toast.undo!; setToast(null); focusAction(u.day, u.action); setAction(u.day, u.action, u.to); }}
              >
                {copy.common.undo}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
