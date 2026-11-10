import Link from "next/link";
import { Logo } from "@/components/Logo";
import { copy } from "@/content/copy.he";
import { requireUser } from "@/lib/auth/dal";
import { fill } from "@/lib/format";
import { serverNow } from "@/lib/today/clock";
import { getSchedule } from "@/lib/today/schedule";
import { todayModel } from "@/lib/today/view";
import { BottomNav } from "./BottomNav";
import { LogoutForm } from "./LogoutForm";
import { MotionToggle } from "./MotionToggle";
import { PwaBoot } from "./PwaBoot";

export async function AppShell({ children }: { children: React.ReactNode }) {
  // הדפים בודקים את הסשן בעצמם; כאן זה בשביל הכותרת (ה־layout לא רץ מחדש בכל ניווט).
  await requireUser();
  const model = todayModel(await serverNow(), getSchedule());
  return (
    <div className="app">
      <a href="#main" className="skip-link">
        {copy.a11y.skipLink}
      </a>
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
        <LogoutForm />
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
