"use client";

import { useEffect, useState } from "react";
import { copy } from "@/content/copy.he";
import { PauseIcon, PlayIcon } from "./icons";

const KEY = "tsaad-motion";

function readStored(): "off" | "on" | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "off" || v === "on" ? v : null;
  } catch {
    return null;
  }
}

/**
 * עצירת אנימציה (2.2.2). מצב התחלתי: מושהה אם המערכת מבקשת פחות תנועה (ה־CSS עוצר גם הוא), אחרת לפי מה שנשמר.
 * הבחירה נשמרת לכל צופה ב־localStorage (עטוף ב־try/catch; בלעדיו המסך עובד כרגיל).
 */
export function MotionToggle() {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const stored = readStored();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const initial = stored ? stored === "off" : reduced;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- מסנכרנים מצב מהדפדפן אחרי ההידרציה
    setPaused(initial);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.motion = paused ? "off" : "on";
  }, [paused]);

  function toggle() {
    const next = !paused;
    setPaused(next);
    try {
      window.localStorage.setItem(KEY, next ? "off" : "on");
    } catch {
      /* אין אחסון: הבחירה תחול רק בביקור הזה */
    }
  }

  return (
    <button
      type="button"
      className="motion-btn"
      aria-pressed={paused}
      aria-label={copy.a11y.pauseMotion}
      title={copy.a11y.pauseMotion}
      onClick={toggle}
    >
      {paused ? <PlayIcon /> : <PauseIcon />}
    </button>
  );
}
