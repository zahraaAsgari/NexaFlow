import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app/app-shell";
import { requireContext } from "@/server/auth";
import { listUserOrganizations } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/**
 * Private application routes are never indexed.
 * This covers dashboard, clients, projects, tasks, team, settings, and account.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * The single authentication boundary for the authenticated application group.
 * `requireContext()` redirects unauthenticated requests to /login and returns
 * the verified tenant context; pages resolve their own context again for the
 * data they load. Only safe display data is handed to the shell.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireContext();
  const memberships = await listUserOrganizations(ctx.user.id);

  return (
    <AppShell
      ctx={ctx}
      organizations={memberships.map((membership) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
      }))}
    >
      {children}
    </AppShell>
  );
}
