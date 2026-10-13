"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/icons";
import type { NavItem } from "./nav-items";

/**
 * The single mechanism for active-navigation state. `usePathname` is resolved
 * here and nowhere else, so no other component hard-codes route matching.
 */
export function NavLink({
  item,
  onNavigate,
}: {
  item: NavItem;
  /** Closes the mobile drawer after navigation. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active =
    pathname === item.href || pathname.startsWith(`${item.href}/`);

  if (item.comingSoon) {
    return (
      <span
        aria-disabled="true"
        title="This module is not available yet"
        className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400"
      >
        <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">{item.label}</span>
        <span className="ms-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Soon
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 ${
        active
          ? "bg-indigo-50 text-indigo-700"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
