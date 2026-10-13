import Link from "next/link";
import { redirect } from "next/navigation";

import { requireContext } from "@/server/auth";
import { createTaskAction } from "@/server/actions/tasks";
import { listOrganizationMembers } from "@/server/data/members";
import { listProjects } from "@/server/data/projects";
import { TaskForm } from "@/components/tasks/task-form";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";
import { Icon } from "@/components/icons";
import { projectParamsSchema } from "@/server/validation/projects";

export const dynamic = "force-dynamic";

/** Upper bound for the selector; large workspaces are noted as a limitation. */
const PROJECT_OPTIONS_LIMIT = 200;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requireContext();
  // Members cannot manage tasks; the server action enforces the same rule.
  if (ctx.membership.role === "member") redirect("/tasks");

  // Tenant-safe: only this organization's projects and members can populate
  // the selectors, and both ids are re-verified by the server action.
  const [projects, members] = await Promise.all([
    listProjects(ctx, { limit: PROJECT_OPTIONS_LIMIT, offset: 0 }),
    listOrganizationMembers(ctx),
  ]);

  // Optional pre-selected project (e.g. "Add task" from a project page). It is
  // only a UI default: an id from another tenant simply won't match an option,
  // and the action re-verifies whatever is submitted.
  const raw = await searchParams;
  const candidate = projectParamsSchema.safeParse({
    id: typeof raw.projectId === "string" ? raw.projectId : "",
  });
  const preselected =
    candidate.success && projects.some((p) => p.id === candidate.data.id)
      ? candidate.data.id
      : "";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-500 outline-none transition hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
          Back to tasks
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          New task
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Add a task to {ctx.organization.name}.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon="projects"
            title="Create a project first."
            description="Every task belongs to a project, so add a project before creating tasks."
          >
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2"
            >
              <Icon name="plus" className="h-4 w-4" />
              Create a project
            </Link>
          </EmptyState>
        </Card>
      ) : (
        <Card className="p-6">
          <TaskForm
            action={createTaskAction}
            defaults={{
              projectId: preselected,
              title: "",
              assigneeId: "",
              status: "todo",
              priority: "medium",
              dueDate: "",
            }}
            projects={projects.map((project) => ({
              id: project.id,
              name: project.name,
            }))}
            members={members.map((member) => ({
              userId: member.userId,
              name: member.name,
            }))}
            submitLabel="Create task"
            pendingLabel="Creating…"
            cancelHref="/tasks"
          />
        </Card>
      )}
    </div>
  );
}
