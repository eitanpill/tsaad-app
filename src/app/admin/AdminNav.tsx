"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** קישורים בין דפי הבעלים. הדף הנוכחי מסומן ב־aria-current. */
export function AdminNav(p: { label: string; stats: string; participants: string }) {
  const path = usePathname();
  return (
    <nav className="adm-nav" aria-label={p.label}>
      <Link href="/admin/stats" aria-current={path.startsWith("/admin/stats") ? "page" : undefined}>
        {p.stats}
      </Link>
      <Link href="/admin/participants" aria-current={path.startsWith("/admin/participants") ? "page" : undefined}>
        {p.participants}
      </Link>
    </nav>
  );
}
