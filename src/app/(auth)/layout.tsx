import type { Metadata } from "next";
import { copy } from "@/content/copy.he";
import "./auth.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  // same-origin, not no-referrer: no Referer leaves the site (so the /activate token never
  // reaches a third party), while a form posted before hydration or without JS keeps a real
  // Origin. With no-referrer, browsers send "Origin: null" on form navigations and the
  // server-action origin checks reject the login.
  referrer: "same-origin",
};

/** מעטפת המסכים שלפני ההתחברות: כותרת (לוגו ושורת שם), דילוג לתוכן ו־main. אין סרגל ניווט. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <a href="#main" className="skip-link">
        {copy.a11y.skipLink}
      </a>
      <header className="auth-header">
        <span className="auth-logo" role="img" aria-label={copy.a11y.logo}>
          YOGIT
        </span>
        <span className="auth-byline">{copy.brand.byline}</span>
      </header>
      <main id="main" className="auth-main">
        {children}
      </main>
    </div>
  );
}
