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

/** מסכי היום (/day/[n]) שייכים ללשונית "השביל": משם מגיעים אליהם. */
function isCurrent(pathname: string, href: string): boolean {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  return href === "/path" && pathname.startsWith("/day/");
}

/** ניווט תחתון. מסך ההתקנה (/install) הוא צעד הדרכה בלי ניווט, כמו בעיצוב. */
export function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/install") return null;
  return (
    <nav className="bnav" aria-label={copy.a11y.mainNav}>
      {ITEMS.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          prefetch={href === "/today"}
          aria-current={isCurrent(pathname, href) ? "page" : undefined}
        >
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}
