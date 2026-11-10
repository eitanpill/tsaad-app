import type { Metadata } from "next";
import Link from "next/link";
import { copy } from "@/content/copy.he";

export const metadata: Metadata = { title: `${copy.states.notFound.heading} | ${copy.brand.name}`, robots: { index: false, follow: false } };

/**
 * 404 לכל כתובת שאין לה דף (וגם /day/<לא יום תקין>, דרך proxy.ts), בעברית ובסטטוס 404 אמיתי.
 * בלי מעטפת המשתמש: לא קוראים כאן סשן. הקישור ל־/today מוביל לכניסה כשאין סשן.
 */
export default function NotFound() {
  return (
    <main className="nf-page">
      <section className="nf-card" aria-labelledby="nf-root-h">
        <h1 id="nf-root-h">{copy.states.notFound.heading}</h1>
        <p>{copy.states.notFound.body}</p>
        <Link href="/today" className="nf-action">
          {copy.states.notFound.action}
        </Link>
      </section>
    </main>
  );
}
