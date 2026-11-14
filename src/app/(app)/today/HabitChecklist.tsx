"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import { buildChecklist, type ChecklistItem } from "@/lib/habits/model";
import { CheckIcon } from "../_components/icons";
import { toggleHabit } from "./habit-actions";

export type HabitRow = { habitDay: number; title: string };

/**
 * ההרגלים הישנים (habit_checks) של יום אחד: מצב שמור + עדכון אופטימי, כמו סימון הפעולות. ההרגל החדש של היום הוא שלב ה"הרגל"
 * הקיים ואינו כאן (הוא מגיע מההורה, ראו HabitChecklist).
 */
function useOlderHabits(day: number, initial: number[], cb: { onSaved: (to: boolean) => void; onError: (retry: () => void, habitDay: number) => void }) {
  const [saved, setSaved] = useState<number[]>(initial);
  const [optimistic, apply] = useOptimistic(saved, (cur: number[], p: { h: number; to: boolean }) =>
    p.to ? (cur.includes(p.h) ? cur : [...cur, p.h]) : cur.filter((x) => x !== p.h),
  );
  const [, start] = useTransition();
  function set(h: number, to: boolean) {
    start(async () => {
      apply({ h, to });
      let ok = false;
      try {
        const res = await toggleHabit(day, h, to);
        ok = res.ok;
        if (res.ok) setSaved((cur) => (to ? (cur.includes(h) ? cur : [...cur, h]) : cur.filter((x) => x !== h)));
      } catch {
        ok = false;
      }
      if (ok) cb.onSaved(to);
      else cb.onError(() => set(h, to), h);
    });
  }
  return { checked: optimistic, set };
}

export const habitKey = (day: number, habitDay: number) => `h${day}:${habitDay}`;

/**
 * "ההרגלים שלי": רשימת תיבות סימון מצטברת. ההרגל החדש הוא שלב ה"הרגל" (stepDone / onToggleStep מההורה, כך שהכוס זזה בדיוק כמו בכפתור);
 * שאר ההרגלים נשמרים ב־habit_checks. מקבלים key={day} כדי שמצב ישן לא יישאר אחרי מעבר יום.
 * רק כותרות של ימים שנפתחו מגיעות לכאן (ההרגלים 1..day).
 */
export function HabitChecklist({
  day,
  habits,
  initialOlder,
  stepDone,
  onToggleStep,
  onSaved,
  onError,
  headingLevel = 2,
  markNew = true,
}: {
  day: number;
  habits: HabitRow[];
  initialOlder: number[];
  stepDone: boolean;
  onToggleStep: () => void;
  onSaved: (to: boolean) => void;
  onError: (retry: () => void, habitDay: number) => void;
  headingLevel?: 2 | 3;
  /** מסמן את ההרגל האחרון "חדש היום" ומציג את ההסבר (רק במסך היום; ביום קודם ההרגל היה חדש באותו יום). */
  markNew?: boolean;
}) {
  const uid = useId();
  const older = useOlderHabits(day, initialOlder, { onSaved, onError });
  const items = buildChecklist(day, habits, stepDone, older.checked);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const done = items.filter((i) => i.checked).length;

  return (
    <section className="t t-habits ar-habits" aria-labelledby={`${uid}-h`}>
      <div className="habits-head">
        <Heading id={`${uid}-h`} className="act-title">
          {copy.habits.title}
        </Heading>
        <span className="habits-count">{fill(items.length === 1 ? copy.habits.countOne : copy.habits.count, { done, total: items.length })}</span>
      </div>
      {markNew ? <p className="act-hint">{copy.habits.intro}</p> : null}
      <ul className="habit-list" aria-label={fill(copy.a11y.habits.group, { n: day })}>
        {items.map((it) => (
          <HabitRowView
            key={it.habitDay}
            day={day}
            item={it}
            markNew={markNew}
            onChange={() => (it.isNew ? onToggleStep() : older.set(it.habitDay, !it.checked))}
          />
        ))}
      </ul>
      {markNew && day > 1 ? <p className="act-hint">{copy.habits.note}</p> : null}
    </section>
  );
}

function HabitRowView({ day, item, markNew, onChange }: { day: number; item: ChecklistItem; markNew: boolean; onChange: () => void }) {
  return (
    <li className="habit" data-new={item.isNew} data-checked={item.checked}>
      <label className="habit-label">
        <input
          type="checkbox"
          className="habit-box"
          data-habit-key={habitKey(day, item.habitDay)}
          checked={item.checked}
          onChange={onChange}
        />
        <span className="habit-tick" aria-hidden="true">
          {item.checked ? <CheckIcon size={16} /> : null}
        </span>
        <span className="habit-text">
          {item.title}
          {item.isNew && markNew ? <span className="habit-new">{copy.habits.newTag}</span> : null}
        </span>
      </label>
    </li>
  );
}

/** תצוגה לקריאה בלבד (ימים שנסגרו): אותה רשימה, בלי תיבות סימון. המצב בטקסט, לא רק בצבע. */
export function HabitChecklistReadOnly({ day, items }: { day: number; items: ChecklistItem[] }) {
  const done = items.filter((i) => i.checked).length;
  return (
    <section className="t t-habits" aria-labelledby="habits-ro-h">
      <div className="habits-head">
        <h2 id="habits-ro-h" className="act-title">
          {copy.habits.title}
        </h2>
        <span className="habits-count">{fill(items.length === 1 ? copy.habits.countOne : copy.habits.count, { done, total: items.length })}</span>
      </div>
      <ul className="ro-list" aria-label={fill(copy.a11y.habits.list, { n: day })}>
        {items.map((it) => (
          <li key={it.habitDay} className="ro-item" data-marked={it.checked}>
            <span className="habit-text">
              {it.title}
            </span>
            <span className="ro-state">
              {it.checked ? <CheckIcon size={14} /> : null}
              {it.checked ? copy.habits.marked : copy.habits.notMarked}
            </span>
          </li>
        ))}
      </ul>
      <p className="act-hint">{fill(copy.habits.closed, { n: day })}</p>
    </section>
  );
}
