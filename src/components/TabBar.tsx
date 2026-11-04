"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "grid" },
  { href: "/today", label: "Today", icon: "sun" },
  { href: "/tomorrow", label: "Tomorrow", icon: "moon" },
  { href: "/reminders", label: "Reminders", icon: "bell" },
];

export function TabBar() {
  const path = usePathname().replace(/\/$/, "") || "/";
  // Pages without their own tab, such as a module, sit under Home.
  const active = TABS.some((tab) => tab.href === path) ? path : "/";

  return (
    <nav className="tabs" aria-label="Main">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          className={tab.href === active ? "tab on" : "tab"}
          href={tab.href}
          aria-current={tab.href === path ? "page" : undefined}
        >
          <span>
            <Icon name={tab.icon} />
          </span>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
