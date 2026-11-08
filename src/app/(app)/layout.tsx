import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "./_components/AppShell";
import { ShellLoading } from "./_components/ShellLoading";
import "./app.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** מעטפת המסכים של המשתמש המחובר. את הסשן והשעון קוראים בתוך Suspense (ראו AppShell). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellLoading />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
