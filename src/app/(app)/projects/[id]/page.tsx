import Link from "next/link";
import { notFound } from "next/navigation";

import { requireContext } from "@/server/auth";
import { countTasksByProject, getProjectById } from "@/server/data/projects";
import { projectParamsSchema } from "@/server/validation/projects";
import { ProjectStatusBadge } from "@/components/projects/projects-table";
import { TasksList } from "@/components/tasks/tasks-table";
import { EmptyState } from "@/components/app/empty-state";
import { listTasks } from "@/server/data/tasks";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Tasks shown inline on a project page before linking to the full list. */
const PROJECT_TASKS_LIMIT = 10;

type Params = Promise<{ id: string }>;

export default async function ProjectDetailPage({ params }: { params: Params }) {
  const ctx = await requireContext();
  const canManage =
    ctx.membership.role === "owner" || ctx.membership.role === "admin";

  // The id is validated before it ever reaches the data layer.
  const parsed = projectParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();

  // Tenant-scoped query; the client name comes from the same tenant-safe join
  // (no secondary lookup by raw client id).
  const project = await getProjectById(ctx, parsed.data.id);
  if (!project) notFound();

  // Both queries are tenant-scoped; the project itself already resolved
  // inside this organization above.
  const [taskCount, projectTasks] = await Promise.all([
    countTasksByProject(ctx, project.id),
    listTasks(ctx, {
      projectId: project.id,
      limit: PROJECT_TASKS_LIMIT,
      offset: 0,
    }),
  ]);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-500 outline-none transition hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
          Back to projects
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {project.name}
            </h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            for {project.clientName}
          </p>
        </div>

        {canManage ? (
          <div className="flex items-center gap-2.5">
            <Link
              href={`/projects/${project.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            >
              Edit
            </Link>
            <DeleteProjectButton
              projectId={project.id}
              projectName={project.name}
              taskCount={taskCount}
              variant="button"
            />
          </div>
        ) : null}
      </header>

      <Card>
        <CardHeader title="Project details" />
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Description
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                {project.description ?? (
                  <span className="text-slate-400">No description</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Client
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {project.clientName}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Status
              </dt>
              <dd className="mt-1">
                <ProjectStatusBadge status={project.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Created
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {formatDate(project.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Last updated
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {formatDate(project.updatedAt)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section aria-labelledby="project-tasks" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="project-tasks"
            className="text-base font-semibold text-slate-900"
          >
            Tasks
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {taskCount} {taskCount === 1 ? "task" : "tasks"}
              {taskCount > PROJECT_TASKS_LIMIT
                ? ` · showing first ${PROJECT_TASKS_LIMIT}`
                : ""}
            </span>
            {canManage ? (
              <Link
                href={`/tasks/new?projectId=${project.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
              >
                <Icon name="plus" className="h-4 w-4" />
                Add task
              </Link>
            ) : null}
          </div>
        </div>

        {projectTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white">
            <EmptyState
              icon="tasks"
              title="No tasks yet."
              description={`Work tracked for ${project.name} will appear here.`}
            />
          </div>
        ) : (
          <TasksList
            tasks={projectTasks}
            canManage={canManage}
            showProject={false}
          />
        )}

        {taskCount > PROJECT_TASKS_LIMIT ? (
          <Link
            href={`/tasks?q=${encodeURIComponent(project.name)}`}
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-indigo-600 outline-none transition hover:text-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
          >
            View all tasks for this project
            <Icon name="chevronRight" className="h-4 w-4 rtl:rotate-180" />
          </Link>
        ) : null}
      </section>
    </div>
  );
}
