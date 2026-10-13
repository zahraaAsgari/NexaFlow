import type { IconName } from "@/components/icons";

/**
 * The one source of truth for application navigation. Serializable data only
 * (no component references) so it can be rendered from server components and
 * passed into client components alike.
 *
 * Modules that are not implemented yet are marked `comingSoon` and render as
 * non-navigating placeholders — they never link to a route that does not
 * exist, and hidden/disabled navigation is never treated as authorization.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  /** Module is not built yet: rendered as a disabled, non-navigating item. */
  comingSoon?: boolean;
};

export const workspaceNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/clients", label: "Clients", icon: "clients" },
  { href: "/projects", label: "Projects", icon: "projects" },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
];

export const organizationNav: NavItem[] = [
  { href: "/account", label: "Account", icon: "user" },
  { href: "/team", label: "Team", icon: "users" },
  { href: "/settings", label: "Settings", icon: "settings" },
];
