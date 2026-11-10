import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { copy } from "@/content/copy.he";
import { ReleasePush } from "../../_components/ReleasePush";

export const metadata: Metadata = {
  title: `${copy.account.deleted.title} | ${copy.brand.name}`,
  robots: { index: false, follow: false },
};

/** דף האישור אחרי מחיקת חשבון (ציבורי: אין יותר סשן). */
export default function AccountDeleted() {
  const D = copy.account.deleted;
  return (
    <>
      <div className="doc-bar">
        <span className="logo">
          <Logo height={22} />
        </span>
      </div>
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
