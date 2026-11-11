import type { Metadata } from "next";
import { copy } from "@/content/copy.he";
import { legal } from "@/content/legal.he";
import { LegalDocPage } from "../../_components/LegalDocPage";

export const metadata: Metadata = {
  title: `${legal.accessibility.title} | ${copy.brand.name}`,
  description: legal.accessibility.metaDescription,
  alternates: { canonical: "/legal/accessibility" },
  robots: { index: true, follow: true },
};

export default function Page() {
  return <LegalDocPage doc="accessibility" />;
}
