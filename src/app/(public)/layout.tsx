import { copy } from "@/content/copy.he";
import { PublicFooter } from "./_components/PublicFooter";
import "./public.css";

/** מעטפת הדפים הציבוריים (בלי התחברות): דילוג לתוכן, התוכן (כל דף מציג את ה־main שלו) ותחתית עם הקישורים המשפטיים. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pub-shell">
      <a href="#main" className="skip-link">
        {copy.a11y.skipLink}
      </a>
      {children}
      <PublicFooter />
    </div>
  );
}
