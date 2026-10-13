import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/server/validation/tasks";

type Status = keyof typeof TASK_STATUS_LABELS;
type Priority = keyof typeof TASK_PRIORITY_LABELS;

const statusStyles: Record<Status, { dot: string; chip: string }> = {
  todo: { dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600 ring-slate-500/20" },
  in_progress: {
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 ring-amber-600/20",
  },
  done: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
};

const priorityStyles: Record<Priority, string> = {
  low: "text-slate-500",
  medium: "text-slate-700",
  high: "text-red-600",
};

/** Status shown with a dot AND a text label — never colour alone. */
export function TaskStatusBadge({ status }: { status: Status }) {
  const style = statusStyles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}

/** Priority conveyed by text (weight/colour are secondary cues only). */
export function TaskPriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`text-xs font-medium ${priorityStyles[priority]}`}>
      {TASK_PRIORITY_LABELS[priority]}
    </span>
  );
}

/**
 * Renders a date-only value (YYYY-MM-DD) without constructing a local Date,
 * so the displayed day can never shift by a timezone offset.
 */
export function formatDueDate(dueDate: string): string {
  const [year, month, day] = dueDate.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[(month ?? 1) - 1]} ${day}, ${year}`;
}
