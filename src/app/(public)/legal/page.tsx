import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { copy } from "@/content/copy.he";
import { legal } from "@/content/legal.he";

export const metadata: Metadata = {
  title: `${copy.legal.indexTitle} | ${copy.brand.name}`,
  alternates: { canonical: "/legal" },
  robots: { index: true, follow: true },
};

const DOCS = [
  { href: "/legal/accessibility", title: legal.accessibility.title },
  { href: "/legal/privacy", title: legal.privacy.title },
  { href: "/legal/terms", title: legal.terms.title },
] as const;

export default function LegalIndex() {
  return (
    <>
      <div className="doc-bar">
        <Link href="/tsaad" className="logo" aria-label={`${copy.a11y.logo}, ${copy.legal.home}`}>
          <Logo labelled={false} height={22} />
        </Link>
      </div>
      <main id="main" className="doc-main">
        <h1>{copy.legal.indexTitle}</h1>
        <p>{copy.legal.indexLead}</p>
        <ul className="doc-index">
          {DOCS.map((d) => (
            <li key={d.href}>
              <Link href={d.href}>{d.title}</Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
