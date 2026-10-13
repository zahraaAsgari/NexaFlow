import Link from "next/link";
import { notFound } from "next/navigation";

import { requireContext } from "@/server/auth";
import { getTaskById } from "@/server/data/tasks";
import { taskParamsSchema } from "@/server/validation/tasks";
import {
  TaskPriorityBadge,
  TaskStatusBadge,
  formatDueDate,
} from "@/components/tasks/task-badges";
import { DeleteTaskButton } from "@/components/tasks/delete-task-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function TaskDetailPage({ params }: { params: Params }) {
  const ctx = await requireContext();
  const canManage =
    ctx.membership.role === "owner" || ctx.membership.role === "admin";

  // The id is validated before it ever reaches the data layer.
  const parsed = taskParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();

  // Tenant-scoped query; project and assignee names come from the same
  // tenant-bound joins (no secondary lookup by raw id).
  const task = await getTaskById(ctx, parsed.data.id);
  if (!task) notFound();

  const formatTimestamp = (date: Date) =>
    date.toLocaleDateString("en", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-500 outline-none transition hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
          Back to tasks
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {task.title}
            </h1>
            <TaskStatusBadge status={task.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            in{" "}
            <Link
              href={`/projects/${task.projectId}`}
              className="rounded-md font-medium text-indigo-600 outline-none hover:text-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            >
              {task.projectName}
            </Link>
          </p>
        </div>

        {canManage ? (
          <div className="flex items-center gap-2.5">
            <Link
              href={`/tasks/${task.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            >
              Edit
            </Link>
            <DeleteTaskButton
              taskId={task.id}
              taskTitle={task.title}
              variant="button"
            />
          </div>
        ) : null}
      </header>

      <Card>
        <CardHeader title="Task details" />
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Project
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {task.projectName}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Assignee
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {task.assigneeName ?? (
                  <span className="text-slate-400">Unassigned</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Status
              </dt>
              <dd className="mt-1">
                <TaskStatusBadge status={task.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Priority
              </dt>
              <dd className="mt-1">
                <TaskPriorityBadge priority={task.priority} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Due date
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {task.dueDate ? (
                  formatDueDate(task.dueDate)
                ) : (
                  <span className="text-slate-400">No due date</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Created
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {formatTimestamp(task.createdAt)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
