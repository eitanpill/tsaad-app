"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import { MeadowDoodle } from "@/components/Doodles";
import { AlertCircle } from "../_components/icons";

type Phase = "idle" | "loading" | "ready" | "error";

/**
 * הסרטון של היום. כתובת ההטמעה החתומה מבוקשת מהשרת רק בלחיצה (GET /api/video/[day]), והשרת מנפיק אותה
 * רק ליום שנפתח. בלי autoplay. כשאין סרטון מוגדר ליום מוצג מצב ממתין (כפתור כבוי).
 */
export function VideoTile({
  day,
  available,
  title: heading,
  poster = null,
}: {
  day: number;
  available: boolean;
  title?: string;
  /** כתובת תמונה ממוזערת (Bunny), רק כשהוגדר מארח ומזהה סרטון ליום. בלעדיה (או אם נכשלה): איור חמים במקומה. */
  poster?: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [src, setSrc] = useState<string | null>(null);
  const [posterOk, setPosterOk] = useState(true);
  const playRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // כפתור הניגון (או "לנסות שוב") מוחלף בנגן: המיקוד עובר לנגן, ולא נופל לגוף הדף.
  useEffect(() => {
    if (phase === "ready") frameRef.current?.focus();
  }, [phase]);

  async function load() {
    if (!available || phase === "loading") return;
    setPhase("loading");
    try {
      const res = await fetch(`/api/video/${day}`, { cache: "no-store", credentials: "same-origin" });
      const data = (await res.json()) as { url?: string };
      if (!res.ok || typeof data.url !== "string") throw new Error("video");
      setSrc(data.url);
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }

  const title = fill(copy.a11y.video.frameTitle, { n: day });
  return (
    <>
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
      <section className="t t-video" aria-label={title}>
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
                aria-describedby={available ? undefined : "video-pending"}
                onClick={load}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M8.5 5.5 L19 12 L8.5 18.5 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" />
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
        ) : null}
      </section>
    </>
  );
}
