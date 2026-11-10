"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * מרענן את המסך מהשרת ברגע שמשהו בו משתנה (יום נפתח, או חלון הסימון של אתמול נסגר), בלי לשנות את מה שהמשתמש עושה.
 * השעה נקבעת בשרת (nextBoundary); כאן רק ממתינים אליה.
 */
export function RefreshAtBoundary({ atIso }: { atIso: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!atIso) return;
    const ms = new Date(atIso).getTime() - Date.now();
    if (ms <= 0 || ms > 2 ** 31 - 1) return;
    const t = setTimeout(() => router.refresh(), ms + 1000);
    return () => clearTimeout(t);
  }, [atIso, router]);
  return null;
}
