import Link from "next/link";

import type { RecentProject, RecentTask } from "@/server/data/dashboard";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";
import { Icon } from "@/components/icons";
import {
  ProjectStatusBadge,
} from "@/components/projects/projects-table";
import { TaskStatusBadge, formatDueDate } from "@/components/tasks/task-badges";

function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Recent Work — real timestamps, real records. NOT an "activity feed":
 * it is simply the most recently updated projects and most recently created
 * tasks, with the full list links. Nothing is fabricated.
 */
export function RecentWork({
  projects,
  tasks,
}: {
  projects: RecentProject[];
  tasks: RecentTask[];
}) {
  const isEmpty = projects.length === 0 && tasks.length === 0;

  return (
    <section aria-labelledby="recent-work" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="recent-work" className="text-base font-semibold text-slate-900">
          Recent work
        </h2>
      </div>

      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white">
          <EmptyState
            icon="sparkles"
            title="No recent work."
            description="New projects and tasks will appear here as you build."
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recently updated projects */}
          <Card>
            <CardHeader
              title="Recently updated projects"
              description="Latest changes"
            />
            <CardContent className="p-0">
              {projects.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">
                  No projects yet.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <Link
                        href={`/projects/${project.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-900">
                            {project.name}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {project.clientName}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <ProjectStatusBadge status={project.status} />
                          <span className="text-xs text-slate-400">
                            {formatRelative(project.updatedAt)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
            <div className="border-t border-slate-100 px-5 py-3">
              <Link
                href="/projects"
                className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-indigo-600 outline-none transition hover:text-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
              >
                View all projects
                <Icon name="chevronRight" className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
          </Card>

          {/* Recently created tasks */}
          <Card>
            <CardHeader
              title="Recent tasks"
              description="Newest work items"
            />
            <CardContent className="p-0">
              {tasks.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">
                  No tasks yet.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {tasks.map((task) => (
                    <li key={task.id}>
                      <Link
                        href={`/tasks/${task.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-900">
                            {task.title}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {task.projectName}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <TaskStatusBadge status={task.status} />
                          <span className="text-xs text-slate-400">
                            {task.dueDate
                              ? `Due ${formatDueDate(task.dueDate)}`
                              : formatRelative(task.createdAt)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
            <div className="border-t border-slate-100 px-5 py-3">
              <Link
                href="/tasks"
                className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-indigo-600 outline-none transition hover:text-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
              >
                View all tasks
                <Icon name="chevronRight" className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}
