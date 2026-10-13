import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/icons";

/**
 * Quick actions. Implemented modules link to their real creation flows;
 * unbuilt ones stay disabled and honest.
 */
const actions: { label: string; icon: IconName; href?: string }[] = [
  { label: "New client", icon: "clients", href: "/clients/new" },
  { label: "New project", icon: "projects", href: "/projects/new" },
  { label: "New task", icon: "tasks", href: "/tasks/new" },
];

export function QuickActions() {
  return (
    <section aria-labelledby="quick-actions" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="quick-actions"
          className="text-base font-semibold text-slate-900"
        >
          Quick actions
        </h2>
        <span className="text-xs text-slate-400">
          More actions arrive as modules launch
        </span>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {actions.map((action) =>
          action.href ? (
            <Link
              key={action.label}
              href={action.href}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            >
              <Icon name={action.icon} className="h-4 w-4" />
              {action.label}
            </Link>
          ) : (
            <Button
              key={action.label}
              type="button"
              variant="secondary"
              disabled
              title="Coming soon"
            >
              <Icon name={action.icon} className="h-4 w-4" />
              {action.label}
            </Button>
          ),
        )}
      </div>
    </section>
  );
}
