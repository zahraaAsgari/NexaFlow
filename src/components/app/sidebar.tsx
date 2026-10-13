import type { AuthContext } from "@/server/auth";
import { Brand } from "./brand";
import { OrganizationSwitcher } from "./organization-switcher";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import type { OrganizationOption } from "./shell-types";

/**
 * Desktop sidebar. A Server Component: it receives the already-resolved
 * authenticated context and passes only safe display data downward.
 */
export function Sidebar({
  ctx,
  organizations,
}: {
  ctx: AuthContext;
  organizations: OrganizationOption[];
}) {
  return (
    <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-e lg:border-slate-200 lg:bg-white">
      <div className="px-5 py-5">
        <Brand />
      </div>

      <div className="border-y border-slate-100 px-2 py-2.5">
        <OrganizationSwitcher
          organizations={organizations}
          activeOrganizationId={ctx.organization.id}
        />
      </div>

      <SidebarNav />

      <div className="border-t border-slate-100 px-2 py-2.5">
        <UserMenu
          viewer={{
            name: ctx.user.name,
            email: ctx.user.email,
            role: ctx.membership.role,
            organizationName: ctx.organization.name,
          }}
        />
      </div>
    </aside>
  );
}
