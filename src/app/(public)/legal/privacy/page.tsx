import type { Metadata } from "next";
import { copy } from "@/content/copy.he";
import { legal } from "@/content/legal.he";
import { LegalDocPage } from "../../_components/LegalDocPage";

export const metadata: Metadata = {
  title: `${legal.privacy.title} | ${copy.brand.name}`,
  description: legal.privacy.metaDescription,
  alternates: { canonical: "/legal/privacy" },
  robots: { index: true, follow: true },
};

export default function Page() {
  return <LegalDocPage doc="privacy" />;
}
