import type { Metadata } from "next";
import { copy } from "@/content/copy.he";
import { Logo } from "@/components/Logo";
import "./auth.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  // same-origin, not no-referrer: no Referer leaves the site (so the /activate token never
  // reaches a third party), while a form posted before hydration or without JS keeps a real
  // Origin. With no-referrer, browsers send "Origin: null" on form navigations and the
  // server-action origin checks reject the login.
  referrer: "same-origin",
};

/**
 * מעטפת המסכים שלפני ההתחברות: כותרת (לוגו ושורת שם), דילוג לתוכן, main, ותחתית עם הקישורים המשפטיים (הצהרת הנגישות
 * צריכה להיות נגישה מכל עמוד). אין סרגל ניווט. הקישורים הם <a> רגיל (ניווט מלא, לא fetch של Link) עם no-referrer, כך שהטוקן מ־/activate לא נרשם גם ביומני הבקשות של האתר.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <a href="#main" className="skip-link">
        {copy.a11y.skipLink}
      </a>
      <header className="auth-header">
        <span className="auth-logo">
          <Logo />
        </span>
        <span className="auth-byline">{copy.brand.byline}</span>
      </header>
      <main id="main" className="auth-main">
        {children}
      </main>
      <footer className="auth-foot">
        <nav aria-label={copy.legal.indexTitle}>
          <ul>
            <li>
              <a href="/legal/accessibility" referrerPolicy="no-referrer">{copy.landing.footer.accessibility}</a>
            </li>
            <li>
              <a href="/legal/privacy" referrerPolicy="no-referrer">{copy.landing.footer.privacy}</a>
            </li>
            <li>
              <a href="/legal/terms" referrerPolicy="no-referrer">{copy.landing.footer.terms}</a>
            </li>
          </ul>
        </nav>
      </footer>
    </div>
  );
}
