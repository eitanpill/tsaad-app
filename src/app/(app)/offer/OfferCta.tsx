import { copy } from "@/content/copy.he";

/**
 * כפתור יציאה להצעה. כתובת https מוגדרת = קישור (נפתח בלשונית חדשה, כמו הקישור ללייב); אין כתובת (מציין מקום בקופי) =
 * כפתור לא פעיל עם הסבר (aria-disabled, נשאר בפוקוס כדי שההסבר יוקרא). כתובת לא נשלחת ללקוח כשהכפתור לא פעיל.
 */
export function OfferCta({
  href,
  label,
  ariaLabel,
  noteId,
}: {
  href: string | null;
  label: string;
  ariaLabel?: string;
  noteId: string;
}) {
  if (href) {
    return (
      <a className="ofr-cta" href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>
        {label}
      </a>
    );
  }
  return (
    <>
      <button type="button" className="ofr-cta ofr-cta--off" aria-disabled="true" aria-describedby={noteId} aria-label={ariaLabel}>
        {label}
      </button>
      <p id={noteId} className="ofr-note">
        {copy.offer.day14.disabled}
      </p>
    </>
  );
}
