import type { Metadata } from "next";
import { copy } from "@/content/copy.he";
import { legal } from "@/content/legal.he";
import { LegalDocPage } from "../../_components/LegalDocPage";

export const metadata: Metadata = {
  title: `${legal.terms.title} | ${copy.brand.name}`,
  description: legal.terms.metaDescription,
  alternates: { canonical: "/legal/terms" },
  robots: { index: true, follow: true },
};

export default function Page() {
  return <LegalDocPage doc="terms" />;
}
