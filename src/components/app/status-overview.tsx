import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/icons";

type Bar = {
  label: string;
  value: number;
  total: number;
  /** Visual dot only — never the sole signal (label+number always present). */
  dot: string;
};

/**
 * Compact status breakdown using plain segmented bars (no chart library).
 * This duplicates neither tables nor analytics; it is a small visual
 * alongside the numeric primary cards.
 */
export function StatusOverview({
  title,
  description,
  items,
  icon,
  total,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  description?: string;
  items: Bar[];
  icon: IconName;
  /** Real aggregate total (may differ from sum when items are partial). */
  total: number;
  emptyTitle: string;
  emptyDescription: string;
}) {

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Icon name={icon} className="h-[18px] w-[18px] text-slate-400" />
            {title}
          </span>
        }
        description={description}
      />
      <CardContent>
        {total === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm font-medium text-slate-700">{emptyTitle}</p>
            <p className="mt-1 text-sm text-slate-500">{emptyDescription}</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                {items.map(
                  (item) =>
                    item.value > 0 && (
                      <span
                        key={item.label}
                        className={item.dot}
                        style={{ width: `${(item.value / total) * 100}%` }}
                        aria-hidden="true"
                      />
                    ),
                )}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {total} total · status shares are approximate
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              {items.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-sm text-slate-600">
                    <span className={`h-2 w-2 rounded-full ${item.dot}`} aria-hidden="true" />
                    {item.label}
                  </dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
