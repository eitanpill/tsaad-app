import type { Metadata } from "next";
import { copy } from "@/content/copy.he";
import "./auth.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
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
