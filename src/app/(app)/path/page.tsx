import type { Metadata } from "next";
import { copy } from "@/content/copy.he";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/dal";
import { fill } from "@/lib/format";
import { stepsFor } from "@/lib/days";
import { pathModel } from "@/lib/path/view";
import { serverNow } from "@/lib/today/clock";
import { listCompletions } from "@/lib/today/completions";
import { getSchedule } from "@/lib/today/schedule";
import { nextBoundary } from "@/lib/today/view";
import { RefreshAtBoundary } from "../_components/RefreshAtBoundary";
import { PathLegend, PathMap } from "./PathMap";

export const metadata: Metadata = { title: `${copy.nav.path} | ${copy.brand.name}` };

/** השביל: 14 אבנים לפי שעון השרת והסימונים של המשתמש. כל נתון נקרא בשרת; הלקוח מקבל רק מצב לכל אבן. */
export default async function PathPage() {
  const user = await requireUser();
  const now = await serverNow();
  const schedule = getSchedule();
  const rows = await listCompletions(getDb(), user.userId);
  const stepsByDay: Record<number, number> = {};
  for (let d = 1; d <= 14; d++) stepsByDay[d] = stepsFor(d, rows.filter((r) => r.day === d).map((r) => r.action));

  const model = pathModel(now, schedule, stepsByDay);
  const next = schedule ? nextBoundary(now, schedule) : null;
  const counter = fill(copy.path.counter, { n: model.counted });

  return (
    <>
      <RefreshAtBoundary atIso={next ? next.toISOString() : null} />
      <section className="t t-hero t-path-hero" aria-labelledby="path-h">
        <div className="path-hero-row">
          <h1 id="path-h">{copy.path.title}</h1>
          <span className="chip chip--count">{counter}</span>
        </div>
        <p>{model.completed ? fill(copy.path.completed, { n: model.counted }) : copy.path.intro}</p>
      </section>
      <PathMap stones={model.stones} counted={model.counted} />
      <PathLegend states={model.legend} />
    </>
  );
}
