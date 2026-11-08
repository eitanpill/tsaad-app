"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy } from "@/content/copy.he";
import { BellIcon, CupIcon, LiveIcon, PathIcon } from "./icons";

const ITEMS = [
  { href: "/today", label: copy.nav.today, Icon: CupIcon },
  { href: "/path", label: copy.nav.path, Icon: PathIcon },
  { href: "/live", label: copy.nav.live, Icon: LiveIcon },
  { href: "/reminders", label: copy.nav.reminders, Icon: BellIcon },
] as const;

/** ניווט תחתון. המסכים של השביל, הלייב והתזכורות מגיעים בשלבים הבאים (עד אז הקישורים מובילים ל־404). */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bnav" aria-label={copy.a11y.mainNav}>
      {ITEMS.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          prefetch={href === "/today"}
          aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}
        >
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}
