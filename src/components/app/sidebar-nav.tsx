import { NavLink } from "./nav-link";
import { organizationNav, workspaceNav } from "./nav-items";

/**
 * Navigation list shared by the desktop sidebar and the mobile drawer, so the
 * two can never drift apart. Contains no server-only imports, which lets it
 * render inside both server and client trees.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav
      aria-label="Workspace"
      className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4"
    >
      <div className="space-y-1">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Workspace
        </p>
        {workspaceNav.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </div>

      <div className="space-y-1">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Organization
        </p>
        {organizationNav.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}
