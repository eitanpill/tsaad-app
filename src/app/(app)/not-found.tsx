import Link from "next/link";
import { copy } from "@/content/copy.he";

/** דף לא נמצא בתוך המעטפת של המשתמש המחובר (למשל /day/0 או /day/15). */
export default function AppNotFound() {
  return (
    <>
      <section className="t t-hero" aria-labelledby="nf-h">
        <h1 id="nf-h">{copy.states.notFound.heading}</h1>
        <p>{copy.states.notFound.body}</p>
      </section>
      <div className="t t-links">
        <Link href="/today" className="btn-s">
          {copy.states.notFound.action}
        </Link>
      </div>
    </>
  );
}
