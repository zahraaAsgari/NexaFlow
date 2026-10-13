import type { ReactNode, SVGProps } from "react";

/**
 * Inline SVG icon set.
 *
 * Kept hand-rolled so the project carries no icon dependency. Icons are
 * decorative (`aria-hidden`) — every interactive control that uses one also
 * carries a text or `aria-label` equivalent. Directional glyphs flip in RTL
 * via the `rtl:` variant at their usage sites.
 */
export type IconName =
  | "dashboard"
  | "clients"
  | "projects"
  | "tasks"
  | "users"
  | "settings"
  | "chevronDown"
  | "chevronRight"
  | "check"
  | "plus"
  | "menu"
  | "close"
  | "building"
  | "logout"
  | "sparkles"
  | "spinner"
  | "search"
  | "user";

const paths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3.25 3.25 0 0 1 0 6.5" />
      <path d="M17.5 14.8a5.5 5.5 0 0 1 3 4.7" />
    </>
  ),
  clients: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3.25 3.25 0 0 1 0 6.5" />
      <path d="M17.5 14.8a5.5 5.5 0 0 1 3 4.7" />
    </>
  ),
  projects: (
    <>
      <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h3.2l1.6 2H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M3.5 10.5h17" />
    </>
  ),
  tasks: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M8 10l2 2 4-4" />
      <path d="M8 16.5h8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="2.75" />
      <path d="M12 3.5v2.25M12 18.25v2.25M4.9 7.8l1.95 1.13M17.15 15.07l1.95 1.13M4.9 16.2l1.95-1.13M17.15 8.93l1.95-1.13" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  chevronDown: <path d="M6.5 9.5l5.5 5 5.5-5" />,
  chevronRight: <path d="M9.5 6.5l5 5.5-5 5.5" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  building: (
    <>
      <rect x="4.5" y="4.5" width="9" height="15" rx="1.5" />
      <path d="M13.5 9.5H19a1 1 0 0 1 1 1v9" />
      <path d="M7.5 8h3M7.5 11.5h3M7.5 15h3" />
    </>
  ),
  logout: (
    <>
      <path d="M14.5 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h8" />
      <path d="M10.5 12h9" />
      <path d="M16.5 8.5l3 3.5-3 3.5" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 4l1.6 4.1L18 9.5l-4.4 1.4L12 15l-1.6-4.1L6 9.5l4.4-1.4z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
  spinner: <path d="M12 4a8 8 0 1 0 8 8" />,
};

export function Icon({
  name,
  className,
  ...rest
}: { name: IconName; className?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
