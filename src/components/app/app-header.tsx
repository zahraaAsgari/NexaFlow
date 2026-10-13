import type { AuthContext } from "@/server/auth";
import { Icon } from "@/components/icons";
import { MobileNav } from "./mobile-nav";
import type { OrganizationOption } from "./shell-types";

/**
 * Top bar inside the main content area. On small screens it carries the
 * navigation trigger and the wordmark; on desktop it states the product
 * positioning. Nothing here is clickable-only decoration.
 */
export function AppHeader({
  ctx,
  organizations,
}: {
  ctx: AuthContext;
  organizations: OrganizationOption[];
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <MobileNav
          viewer={{
            name: ctx.user.name,
            email: ctx.user.email,
            role: ctx.membership.role,
            organizationName: ctx.organization.name,
          }}
          organizations={organizations}
          activeOrganizationId={ctx.organization.id}
        />

        <span className="text-sm font-semibold tracking-tight text-slate-900 lg:hidden">
          NexaFlow
        </span>

        <p className="hidden items-center gap-2 text-xs text-slate-500 lg:flex">
          <Icon name="sparkles" className="h-4 w-4 text-indigo-500" />
          AI-powered business operations workspace
        </p>
      </div>
    </header>
  );
}
