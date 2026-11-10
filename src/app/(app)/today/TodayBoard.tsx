"use client";

import { useEffect, useId, useMemo, useOptimistic, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CHALLENGE } from "@/config/constants";
import { copy } from "@/content/copy.he";
import { SunDoodle } from "@/components/Doodles";
import {
  actionsForDay,
  computeProgress,
  cupLevel,
  dayCounts,
  stepsFor,
  type Action,
  type Schedule,
} from "@/lib/days";
import { fill } from "@/lib/format";
import { finishSummary } from "@/lib/path/finish";
import { pathModel } from "@/lib/path/view";
import { actionKey, doneActionsFor } from "@/lib/today/view";
import { AlertCircle, CheckIcon, WifiOffIcon } from "../_components/icons";
import { actionDetail, actionTitle, type DayTitles } from "./action-labels";
import { ActionButton } from "./ActionButton";
import { toggleAction } from "./actions";
import { Cup } from "./Cup";
import { FinishTiles } from "./FinishTiles";
import { PathStrip } from "./PathStrip";
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
  /** שורה קטנה מעל הכותרת (ברכה, או "יום N מתוך 14"). */
  eyebrow: string;
  /** הכותרת (h1): הברכה, עם השם הפרטי כשיש; ביום לייב: ההודעה על המפגש. */
  hero: string;
  /** משפט הפתיחה בצילום של היום (רק כשיש יום פתוח), או null. */
  opening: string | null;
  videoAvailable: boolean;
  /** תמונה ממוזערת של סרטון היום (רק כשהוגדרו מארח ומזהה), או null. */
  poster: string | null;
  /** חלון ההצעה של יום 14 פתוח (נקבע בשרת): מוסיף קישור להצעות באריח הסיום. */
  offerOpen: boolean;
  /** תוכן שנקבע בשרת ומוצג בסוף המסך (אחרי יום 14: ההצעות). */
  children?: React.ReactNode;
  /** כותרות הפעולות של היום ושל אתמול בלבד (לא של ימים נעולים). */
  titles: Record<number, DayTitles>;
  /** הרגע הקרוב שבו המסך משתנה (ISO), או null. */
  nextChangeIso: string | null;
};

type Toast =
  | { kind: "saved" | "undone"; text: string; undo?: { day: number; action: Action; to: boolean } }
  | { kind: "error"; text: string; retry: { day: number; action: Action; to: boolean } };

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

export function TodayBoard(p: BoardProps) {
  const [burst, setBurst] = useState(0);
  const [justCompleted, setJustCompleted] = useState(false);
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
    // מה יקרה במילוי: כוס שהתמלאה זה עתה, ו"נספרו 12 ימים" שהושלמו זה עתה (רק מסימון, לא מביטול).
    const doneNow = doneActionsFor(optimistic, day);
    const after = stepsFor(day, to ? [...doneNow, action] : doneNow.filter((a) => a !== action));
    const fills = to && cupLevel(before) !== "full" && cupLevel(after) === "full";
    const completes = to && !progress.completed && !dayCounts(before) && dayCounts(after) && progress.counted + 1 >= CHALLENGE.daysToComplete;
    startTransition(async () => {
      applyOptimistic({ key, done: to });
      if (fills) setBurst((b) => b + 1);
      if (completes) setJustCompleted(true);
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
          text: completes ? copy.finish.toast : fills ? copy.today.toastFull : before === 0 ? copy.today.toastFirst : copy.states.success.saved,
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

  const stones = pathModel(now, p.schedule, stepsByDay).stones;
  const summary = finishSummary(stepsByDay, p.schedule.totalDays);
  const finished = progress.completed;

  return (
    <div className="today">
      <div role="status" className={online ? "visually-hidden" : "offline"}>
        {online ? null : (
          <>
            <WifiOffIcon />
            <b>{copy.states.offline.heading}</b>
          </>
        )}
      </div>

      <section className="t t-hero ar-hero" aria-labelledby="hero-h">
        <SunDoodle className="hero-sun" size={64} />
        <span className="eyebrow-s">{p.eyebrow}</span>
        <h1 id="hero-h">{p.hero}</h1>
        {p.opening ? <p className="opening">{p.opening}</p> : null}
      </section>

      {finished || ended ? (
        <div className="finish-wrap">
          <FinishTiles completed={finished} stones={stones} summary={summary} ended={ended} offerOpen={p.offerOpen} pop={justCompleted} />
        </div>
      ) : (
        <div className="ar-strip">
          <PathStrip stones={stones} counted={progress.counted} day={p.day} />
        </div>
      )}

      {p.showYesterday && p.yesterday ? (
        <section className="t t-yest ar-yest" aria-labelledby={`${yestId}-p`}>
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
                <ActionButton key={a} day={p.yesterday!} action={a} title={actionTitle(p.titles[p.yesterday!], a)} detail={actionDetail(p.titles[p.yesterday!], a)} pressed={optimistic.includes(actionKey(p.yesterday!, a))} onToggle={toggle} wide={i === 0 || a === "live"} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {p.day ? (
        <div className="ar-video">
          <VideoTile day={p.day} available={p.videoAvailable} poster={p.poster} />
        </div>
      ) : null}

      {p.phase === "active" ? (
        <section className="t t--half t-cup ar-cup">
          <Cup level={level} label={cupLabel} burst={burst} width={64} height={77} />
          <span>
            {stepsText}
            <br />
            {level === "empty" ? <span>{copy.today.markHint}</span> : <b>{copy.today.counts}</b>}
          </span>
        </section>
      ) : null}

      {!ended ? (
        <section className="t t--half t-ring ar-ring" aria-label={copy.today.counted}>
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
      ) : null}

      {longNote ? (
        <section className="t t-note t-progress-note ar-note">
          <p>{longNote}</p>
        </section>
      ) : null}

      {p.day ? (
        <div className="t t-actions ar-acts">
          <div className="act-grid">
            {actions.map((a, i) => (
              <ActionButton key={a} day={p.day!} action={a} title={actionTitle(p.titles[p.day!], a)} detail={actionDetail(p.titles[p.day!], a)} pressed={optimistic.includes(actionKey(p.day!, a))} onToggle={toggle} wide={i === 0 || a === "live"} />
            ))}
          </div>
          <p className="act-hint">{p.live ? copy.today.cupExplainLive : copy.today.cupExplain}</p>
        </div>
      ) : null}

      {p.children}

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
    </div>
  );
}
