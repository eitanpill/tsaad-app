"use client";

import { useEffect, useId, useRef, useState } from "react";
import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import { MeadowDoodle } from "@/components/Doodles";
import { AlertCircle } from "../_components/icons";
import { paint } from "@/components/paint";

type Phase = "idle" | "loading" | "ready" | "error";
type Length = "long" | "short";

const LENGTH_KEY = "tsaad.videoLength";

function readStoredLength(): Length | null {
  try {
    const v = window.localStorage.getItem(LENGTH_KEY);
    return v === "short" || v === "long" ? v : null;
  } catch {
    return null;
  }
}

function storeLength(v: Length) {
  try {
    window.localStorage.setItem(LENGTH_KEY, v);
  } catch {
    // בלי אחסון מקומי האפליקציה עובדת כרגיל, רק בלי זיכרון הבחירה
  }
}

/**
 * הסרטון של היום. כתובת ההטמעה החתומה מבוקשת מהשרת רק בלחיצה (GET /api/video/[day]), והשרת מנפיק אותה
 * רק ליום שנפתח. בלי autoplay. כשיש שתי גרסאות (מלאה וקצרה) המשתתפת בוחרת; המלאה נבחרת בפעם הראשונה והבחירה האחרונה
 * נזכרת במכשיר. בחירת אורך לא מסמנת דבר. כשאין סרטון מוגדר ליום מוצג מצב ממתין (כפתור כבוי).
 */
export function VideoTile({
  day,
  availableLong,
  availableShort,
  title: heading,
  poster = null,
  forceChoice = false,
}: {
  day: number;
  availableLong: boolean;
  availableShort: boolean;
  title?: string;
  /** תצוגה מקדימה של מנהל: הבחירה בין המלא לקצר מוצגת תמיד, גם כשרק גרסה אחת הועלתה (השנייה מראה "יעלה בקרוב"). */
  forceChoice?: boolean;
  /** כתובת תמונה ממוזערת (Bunny), רק כשהוגדר מארח ומזהה סרטון ליום. בלעדיה (או אם נכשלה): איור חמים במקומה. */
  poster?: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [chosen, setChosen] = useState<Length>("long");
  const groupName = useId();
  // הבחירה מוצגת כששתי הגרסאות קיימות, וגם כששתיהן עוד לא הועלו (אז שתיהן "יעלה בקרוב"). כשרק אחת הועלתה,
  // משתתפת לא רואה בחירה שמובילה לסרטון חסר: מנוגנת הגרסה הקיימת. במנהל (forceChoice) הבחירה תמיד מוצגת.
  const both = forceChoice || availableLong === availableShort;
  const length: Length = both ? chosen : availableShort ? "short" : "long";
  const available = length === "short" ? availableShort : availableLong;
  const [src, setSrc] = useState<string | null>(null);
  const [posterOk, setPosterOk] = useState(true);
  const playRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // הבחירה האחרונה במכשיר (נקראת אחרי ההידרציה, כדי שה־HTML מהשרת ישאר זהה)
  useEffect(() => {
    const stored = readStoredLength();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- קריאה חד־פעמית של localStorage אחרי ההידרציה
    if (stored) setChosen(stored);
  }, []);

  function choose(next: Length) {
    if (phase === "loading" || next === chosen) return;
    setChosen(next);
    storeLength(next);
    // נגן שנטען (או שגיאה) שייך לאורך הקודם: חוזרים לכפתור הניגון של האורך החדש
    setSrc(null);
    setPhase("idle");
  }

  // כפתור הניגון (או "לנסות שוב") מוחלף בנגן: המיקוד עובר לנגן, ולא נופל לגוף הדף.
  useEffect(() => {
    if (phase === "ready") frameRef.current?.focus();
  }, [phase]);

  async function load() {
    if (!available || phase === "loading") return;
    setPhase("loading");
    try {
      const res = await fetch(`/api/video/${day}${length === "short" ? "?v=short" : ""}`, { cache: "no-store", credentials: "same-origin" });
      const data = (await res.json()) as { url?: string };
      if (!res.ok || typeof data.url !== "string") throw new Error("video");
      setSrc(data.url);
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }

  const title = fill(length === "short" && both ? copy.a11y.video.frameTitleShort : copy.a11y.video.frameTitle, { n: day });
  const lc = copy.today.videoLength;
  return (
    <>
      {both ? (
        <fieldset className="video-len" aria-busy={phase === "loading" ? true : undefined}>
          <legend className="video-len__legend">{lc.legend}</legend>
          {(["long", "short"] as const).map((v) => (
            <div key={v} className="video-len__opt">
              <input
                type="radio"
                id={`${groupName}-${v}`}
                name={groupName}
                value={v}
                checked={length === v}
                onChange={() => choose(v)}
              />
              <label htmlFor={`${groupName}-${v}`}>
                <span className="video-len__label">{v === "long" ? lc.long : lc.short}</span>
                <span className="video-len__time">{v === "long" ? lc.longTime : lc.shortTime}</span>
              </label>
            </div>
          ))}
        </fieldset>
      ) : null}
      {phase === "error" ? (
        <section className="video-err" role="alert" aria-labelledby="video-err-h">
          <AlertCircle />
          <div>
            <h2 id="video-err-h">{copy.states.videoError.heading}</h2>
            <p>{copy.states.videoError.body}</p>
            <button
              type="button"
              className="btn-s"
              onClick={() => {
                // אריח השגיאה נעלם עם הטעינה: המיקוד חוזר לכפתור הניגון
                playRef.current?.focus();
                void load();
              }}
            >
              {copy.states.videoError.retry}
            </button>
          </div>
        </section>
      ) : null}
      <section className="t t-video" aria-label={title} aria-busy={phase === "loading" ? true : undefined}>
        <div className="video-box">
          {phase === "ready" && src ? (
            <iframe
              ref={frameRef}
              src={src}
              title={title}
              loading="lazy"
              allow="fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin"
            />
          ) : (
            <>
              {poster && posterOk ? (
                // eslint-disable-next-line @next/next/no-img-element -- תמונה חיצונית קטנה; אין לה צורך באופטימיזציה
                <img className="poster" src={poster} alt="" loading="lazy" decoding="async" onError={() => setPosterOk(false)} />
              ) : (
                <MeadowDoodle className="scene" aria-hidden="true" />
              )}
              <button
                ref={playRef}
                type="button"
                className="play"
                aria-label={fill(copy.a11y.video.play, { n: day })}
                aria-disabled={!available || phase === "loading" ? true : undefined}
                aria-busy={phase === "loading" ? true : undefined}
                aria-describedby={available ? undefined : "video-pending"}
                onClick={load}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M8.5 5.5 L19 12 L8.5 18.5 Z" strokeWidth="1.6" strokeLinejoin="round" style={paint("white", "white")} />
                </svg>
              </button>
            </>
          )}
        </div>
        <div className="video-cap">
          <h2>{heading ?? copy.today.videoTitle}</h2>
          <span>{fill(copy.today.dayChip, { n: day })}</span>
        </div>
        {!available ? (
          <p id="video-pending" className="video-note">
            {copy.today.videoPending}
          </p>
        ) : (
          // Always present while the video can play, so the words are announced when loading starts (aria-busy alone is silent).
          <p className="video-note video-loading" role="status">
            {phase === "loading" ? copy.today.videoLoading : null}
          </p>
        )}
      </section>
    </>
  );
}
