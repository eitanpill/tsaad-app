"use client";

import { copy } from "@/content/copy.he";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="video-err" role="alert" aria-labelledby="err-h">
      <div>
        <h2 id="err-h">{copy.states.genericError.heading}</h2>
        <p>{copy.states.genericError.body}</p>
        <button type="button" className="btn-s" onClick={reset}>
          {copy.common.retry}
        </button>
      </div>
    </section>
  );
}
