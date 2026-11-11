import Link from "next/link";
import { Logo } from "@/components/Logo";
import { copy } from "@/content/copy.he";
import { requireUser } from "@/lib/auth/dal";
import { fill } from "@/lib/format";
import { getAppClock } from "@/lib/preview/context";
import { stopPreviewAction } from "@/app/admin/participants/actions";
import { todayModel } from "@/lib/today/view";
import { BottomNav } from "./BottomNav";
import { MotionToggle } from "./MotionToggle";
import { PwaBoot } from "./PwaBoot";

export async function AppShell({ children }: { children: React.ReactNode }) {
  // הדפים בודקים את הסשן בעצמם; כאן זה בשביל הכותרת (ה־layout לא רץ מחדש בכל ניווט).
  await requireUser();
  const { now, schedule, previewDay } = await getAppClock();
  const model = todayModel(now, schedule);
  return (
    <div className="app">
      <a href="#main" className="skip-link">
        {copy.a11y.skipLink}
      </a>
      {previewDay !== null ? (
        // a labelled region (landmark), not a live region: it is there from the first paint, on every app page
        <section className="preview-banner" aria-label={copy.admin.previewBanner.label} data-testid="preview-banner">
          <p>{fill(copy.admin.previewBanner.text, { n: previewDay })}</p>
          <form action={stopPreviewAction}>
            <button type="submit" className="linkbtn" aria-label={copy.admin.previewBanner.stopLabel}>
              {copy.admin.previewBanner.stop}
            </button>
          </form>
        </section>
      ) : null}
      <header className="app-header">
        <Link href="/today" className="app-logo" aria-label={copy.a11y.logoHome}>
          <Logo labelled={false} />
        </Link>
        <div className="app-tools">
          <MotionToggle />
          {model.day !== null ? (
            <span className="chip">{fill(copy.common.dayOfTotal, { n: model.day })}</span>
          ) : null}
        </div>
      </header>
      <main id="main" className="app-main">
        {children}
        <nav className="app-foot app-foot--links" aria-label={copy.account.legal.heading}>
          <Link href="/account" className="linkbtn">
            {copy.account.footerLink}
          </Link>
          <Link href="/legal" className="linkbtn">
            {copy.account.legalLink}
          </Link>
        </nav>
      </main>
      <BottomNav />
      <PwaBoot />
    </div>
  );
}
