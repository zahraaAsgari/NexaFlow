"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { logoutAction } from "@/server/actions/auth";
import { Icon } from "@/components/icons";
import type { ViewerInfo } from "./shell-types";

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

/**
 * Account menu. Sign out goes through the existing `logoutAction`, which
 * deletes the server-side session row before clearing the cookie — the cookie
 * alone can never authenticate anyone afterwards.
 */
export function UserMenu({ viewer }: { viewer: ViewerInfo }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
          {initials(viewer.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">
            {viewer.name}
          </span>
          <span className="block truncate text-xs capitalize text-slate-400">
            {viewer.role}
          </span>
        </span>
        <Icon
          name="chevronDown"
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute bottom-full z-40 mb-2 w-full min-w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-slate-900">
              {viewer.name}
            </p>
            <p className="truncate text-xs text-slate-500">{viewer.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium capitalize text-indigo-700">
                {viewer.role}
              </span>
              <span className="inline-flex max-w-full items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                <span className="truncate">{viewer.organizationName}</span>
              </span>
            </div>
          </div>

          <Link
            href="/account"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
          >
            <Icon name="user" className="h-4 w-4 shrink-0" />
            Account
          </Link>

          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            >
              <Icon name="logout" className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
