import Link from "next/link";

import { Icon, type IconName } from "@/components/icons";
import { Card } from "@/components/ui/card";

/**
 * Primary metric card — a real number backed by a tenant-safe query. No
 * trend arrows, deltas, or percentages. The whole card is a link to the
 * relevant module.
 */
export function MetricCard({
  label,
  value,
  description,
  icon,
  href,
  hint,
}: {
  label: string;
  value: number;
  description: string;
  icon: IconName;
  href: string;
  hint?: string;
}) {
  return (
    <Link href={href} className="group block focus:outline-none">
      <Card className="h-full p-5 transition group-hover:border-indigo-200 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-indigo-500/60 group-focus-visible:ring-offset-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              {value}
            </p>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-100">
            <Icon name={icon} className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-3 truncate text-sm text-slate-500">{description}</p>
        {hint ? (
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
            {hint}
            <Icon name="chevronRight" className="h-3.5 w-3.5 rtl:rotate-180" />
          </p>
        ) : null}
      </Card>
    </Link>
  );
}
