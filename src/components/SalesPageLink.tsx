import type { ReactNode } from "react";

/**
 * קישור לדף המכירה (/tsaad) כטעינת דף מלאה ולא כניווט של Next (<Link>): ה־CSP של /tsaad פתוח לפיקסל של מטא
 * (src/proxy.ts), ובניווט בתוך האפליקציה נשאר ה־CSP של הדף הקודם, והפיקסל היה נחסם.
 */
export function SalesPageLink({ className, ariaLabel, children }: { className?: string; ariaLabel?: string; children: ReactNode }) {
  return (
    <a href="/tsaad" className={className} aria-label={ariaLabel}>
      {children}
    </a>
  );
}
