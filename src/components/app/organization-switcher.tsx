"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { switchOrganizationAction } from "@/server/actions/auth";
import { Icon } from "@/components/icons";
import type { OrganizationOption } from "./shell-types";

/**
 * Organization switcher.
 *
 * The browser only ever submits *which* organization it wants — the value is
 * used as a lookup key, never as authorization. The existing
 * `switchOrganizationAction` resolves the authenticated user server-side and
 * rejects any organization they are not a member of, so this component can
 * never widen tenant access.
 */
export function OrganizationSwitcher({
  organizations,
  activeOrganizationId,
}: {
  organizations: OrganizationOption[];
  activeOrganizationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const active =
    organizations.find((org) => org.id === activeOrganizationId) ??
    organizations[0];

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

  function switchTo(organizationId: string) {
    setFailed(false);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("organizationId", organizationId);

      const result = await switchOrganizationAction(
        { status: "idle" },
        formData,
      );

      if (result.status === "error") {
        setFailed(true);
        return;
      }
      // Re-render the server tree so the whole shell reflects the new tenant.
      setOpen(false);
      router.refresh();
    });
  }

  if (organizations.length <= 1) {
    return (
      <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
          <Icon name="building" className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {active?.name ?? "No organization"}
          </p>
          <p className="truncate text-xs text-slate-400">
            {active?.slug ?? "—"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Switch organization"
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
          <Icon name="building" className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">
            {active?.name}
          </span>
          <span className="block truncate text-xs text-slate-400">
            {active?.slug}
          </span>
        </span>
        <Icon
          name="chevronDown"
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Organizations"
          className="absolute z-40 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {organizations.map((org) => {
            const isActive = org.id === activeOrganizationId;
            return (
              <button
                key={org.id}
                type="button"
                role="option"
                aria-selected={isActive}
                disabled={isActive || isPending}
                onClick={() => switchTo(org.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 disabled:cursor-default ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Icon
                  name="check"
                  className={`h-4 w-4 shrink-0 ${isActive ? "opacity-100" : "opacity-0"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{org.name}</span>
                  <span
                    className={`block truncate text-xs ${isActive ? "text-indigo-500" : "text-slate-400"}`}
                  >
                    {org.slug}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {failed ? (
        <p role="alert" className="mt-1 px-3 text-xs text-red-600">
          Couldn&apos;t switch organization. Please try again.
        </p>
      ) : null}
    </div>
  );
}
