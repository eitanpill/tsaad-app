import Link from "next/link";
import { copy } from "@/content/copy.he";

/** תחתית הדפים הציבוריים: מידע משפטי וכניסה למשתתפים. */
export function PublicFooter() {
  const f = copy.landing.footer;
  return (
    <footer className="pub-foot">
      <nav aria-label={f.nav}>
        <ul>
          <li><Link href="/legal/accessibility">{f.accessibility}</Link></li>
          <li><Link href="/legal/privacy">{f.privacy}</Link></li>
          <li><Link href="/legal/terms">{f.terms}</Link></li>
          <li><Link href="/login">{f.login}</Link></li>
        </ul>
      </nav>
      <p>{f.copyright}</p>
    </footer>
  );
}
