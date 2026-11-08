"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** כותרת שמקבלת פוקוס כשהיא מופיעה (מצב אישור, קישור שפג), כדי שקורא מסך יכריז עליה. */
export function FocusHeading({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h2 ref={ref} id={id} tabIndex={-1} className={className}>
      {children}
    </h2>
  );
}
