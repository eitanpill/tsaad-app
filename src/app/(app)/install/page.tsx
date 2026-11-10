import type { Metadata } from "next";
import { copy } from "@/content/copy.he";
import { requireUser } from "@/lib/auth/dal";
import { InstallGuide } from "./InstallGuide";

export const metadata: Metadata = { title: `${copy.install.title} | ${copy.brand.name}` };

/** הדרכת התקנה למסך הבית (לא מחליפה את ה־manifest: הוא מגיע מ־app/manifest.ts). */
export default async function InstallPage() {
  await requireUser();
  return <InstallGuide />;
}
