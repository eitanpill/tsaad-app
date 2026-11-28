"use client";

import { useRef, useState } from "react";
import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";

/**
 * נגן השמע של הקלטת המדיטציה, מתחת לסרטון. נגן הדפדפן המובנה (controls): נגיש למקלדת ולקורא מסך, עובד ב־PWA באייפון.
 * בלי autoplay ובלי טעינה מראש (preload="none"): שום דבר לא יורד עד שלוחצים ניגון. ה־src הוא /api/audio/[day],
 * שבודק סשן ויום פתוח ומפנה לקובץ ב־Bunny. כשאין הקלטה ליום: הודעת "תעלה בקרוב" בלי נגן.
 */
export function AudioTile({ day, available }: { day: number; available: boolean }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLAudioElement>(null);
  const label = fill(copy.a11y.audio.player, { n: day });
  const a = copy.today.audio;
  const headId = `audio-h-${day}`;
  return (
    <section className="t t-audio" aria-labelledby={headId}>
      <div className="audio-cap">
        <h2 id={headId}>{a.title}</h2>
        {available ? <p>{a.lead}</p> : null}
      </div>
      {available ? (
        <audio
          ref={ref}
          className="audio-el"
          controls
          preload="none"
          src={`/api/audio/${day}`}
          aria-label={label}
          onError={() => setFailed(true)}
          onPlaying={() => setFailed(false)}
        >
          {a.unsupported}
        </audio>
      ) : (
        <p className="video-note">{a.pending}</p>
      )}
      {failed ? (
        <div className="audio-err" role="alert">
          <p>{a.error}</p>
          <button
            type="button"
            className="btn-s"
            onClick={() => {
              setFailed(false);
              ref.current?.load();
              ref.current?.focus();
            }}
          >
            {a.retry}
          </button>
        </div>
      ) : null}
    </section>
  );
}
