import { copy } from "@/content/copy.he";

/**
 * "אני בפנים". יעד מוגדר (https) = קישור; יעד שהוא עדיין מציין מקום = כפתור לא פעיל עם ההסבר (aria-disabled, נשאר בפוקוס
 * כדי שהטקסט יוקרא), כמו הכפתורים הלא פעילים ב־/live.
 */
export function LandingCta({ href, label, noteId }: { href: string | null; label: string; noteId: string }) {
  if (href) {
    return (
      <a className="cta" href={href} aria-label={copy.a11y.landing.cta}>
        {label}
      </a>
    );
  }
  return (
    <>
      <button type="button" className="cta cta--off" aria-disabled="true" aria-describedby={noteId}>
        {label}
      </button>
      <p id={noteId} className="cta-note">
        {copy.landing.hero.ctaDisabledNote}
      </p>
    </>
  );
}
