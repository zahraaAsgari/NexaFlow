import type { ReactNode } from "react";

import type { AuthContext } from "@/server/auth";
import { AppHeader } from "./app-header";
import { Sidebar } from "./sidebar";
import type { OrganizationOption } from "./shell-types";

/**
 * Application shell: sidebar + main content area. Rendering this from the
 * authenticated layout guarantees every route inside the group gets the same
 * chrome and the same single authentication check.
 */
export function AppShell({
  ctx,
  organizations,
  children,
}: {
  ctx: AuthContext;
  organizations: OrganizationOption[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow-lg"
      >
        Skip to content
      </a>

      <Sidebar ctx={ctx} organizations={organizations} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader ctx={ctx} organizations={organizations} />
        <main
          id="main-content"
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
