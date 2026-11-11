import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { Logo } from "@/components/Logo";
import { copy } from "@/content/copy.he";
import { ReleasePush } from "../../_components/ReleasePush";

export const metadata: Metadata = {
  title: `${copy.account.deleted.title} | ${copy.brand.name}`,
  robots: { index: false, follow: false },
};

/**
 * דף האישור אחרי מחיקת חשבון (ציבורי: אין יותר סשן).
 * מי שעדיין מחובר/ת לא מחק/ה חשבון, ולכן מופנה ל־/today: כך קישור חיצוני לדף הזה לא יכול לבטל את מנוי ההתראות
 * של דפדפן של משתמש פעיל (ReleasePush). ביטול המנוי עצמו מקומי לדפדפן בלבד; אין כאן שום פעולה מול השרת.
 */
export default async function AccountDeleted() {
  if (await verifySession()) redirect("/today");
  const D = copy.account.deleted;
  return (
    <>
      <header className="doc-bar">
        <span className="logo">
          <Logo height={22} />
        </span>
      </header>
      <main id="main" className="doc-main">
        <h1>{D.title}</h1>
        <p>{D.body}</p>
        <p>{D.outside}</p>
        <ReleasePush />
        <Link href="/tsaad" className="cta">
          {D.toLanding}
        </Link>
        <p>
          <Link href="/legal/privacy" className="doc-back">
            {D.toPrivacy}
          </Link>
        </p>
      </main>
    </>
  );
}
