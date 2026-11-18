"use client";

import { copy } from "@/content/copy.he";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="video-err" role="alert" aria-labelledby="err-h">
      <div>
        {/* The shell has no h1 of its own; this error replaces the whole page content, so its title is the page heading. */}
        <h1 id="err-h">{copy.states.genericError.heading}</h1>
        <p>{copy.states.genericError.body}</p>
        <button type="button" className="btn-s" onClick={reset}>
          {copy.common.retry}
        </button>
      </div>
    </section>
  );
}
