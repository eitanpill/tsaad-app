"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import { AlertCircle } from "../_components/icons";

type Phase = "idle" | "loading" | "ready" | "error";

/**
 * הסרטון של היום. כתובת ההטמעה החתומה מבוקשת מהשרת רק בלחיצה (GET /api/video/[day]), והשרת מנפיק אותה
 * רק ליום שנפתח. בלי autoplay. כשאין סרטון מוגדר ליום מוצג מצב ממתין (כפתור כבוי).
 */
export function VideoTile({ day, available }: { day: number; available: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [src, setSrc] = useState<string | null>(null);
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
              <svg className="scene" aria-hidden="true" viewBox="0 0 346 172" preserveAspectRatio="none" focusable="false">
                <circle cx="270" cy="54" r="34" fill="#F0E8E1" opacity="0.22" />
                <path d="M0 132 C 80 104, 150 140, 230 116 C 290 98, 320 110, 346 104 L346 172 L0 172 Z" fill="#123021" opacity="0.55" />
              </svg>
              <button
                ref={playRef}
                type="button"
                className="play"
                aria-label={fill(copy.a11y.video.play, { n: day })}
                aria-disabled={!available || phase === "loading" ? true : undefined}
                aria-describedby={available ? undefined : "video-pending"}
                onClick={load}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M8 5 L19 12 L8 19 Z" fill="#FFFFFF" />
                </svg>
              </button>
            </>
          )}
        </div>
        <div className="video-cap">
          <h2>{copy.today.videoTitle}</h2>
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
