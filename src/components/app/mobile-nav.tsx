"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Brand } from "./brand";
import { OrganizationSwitcher } from "./organization-switcher";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import type { OrganizationOption, ViewerInfo } from "./shell-types";

/**
 * Mobile navigation drawer (below `lg`). The panel is anchored to the inline
 * start edge and slides away in the inline direction, so it mirrors correctly
 * in RTL without any mirrored values. Unmounting the panel keeps focus from
 * leaking behind it; focus returns to the trigger on close.
 */
export function MobileNav({
  viewer,
  organizations,
  activeOrganizationId,
}: {
  viewer: ViewerInfo;
  organizations: OrganizationOption[];
  activeOrganizationId: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="-ms-1 grid h-9 w-9 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 lg:hidden"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Application navigation"
            className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
              <Brand />
              <button
                ref={closeRef}
                type="button"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                aria-label="Close navigation"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-slate-100 px-2 py-2.5">
              <OrganizationSwitcher
                organizations={organizations}
                activeOrganizationId={activeOrganizationId}
              />
            </div>

            <SidebarNav onNavigate={() => setOpen(false)} />

            <div className="border-t border-slate-100 px-2 py-2.5">
              <UserMenu viewer={viewer} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
