import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";

/**
 * Shared empty state. Used for "no records yet" and, later, for first-run
 * states of every module, so the product speaks with one voice.
 */
export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon: IconName;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-900">{title}</p>
      {description ? (
        <p className="mt-1 max-w-xs text-sm text-slate-500">{description}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
