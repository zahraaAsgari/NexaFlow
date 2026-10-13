import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireContext } from "@/server/auth";
import { updateTaskAction } from "@/server/actions/tasks";
import { listOrganizationMembers } from "@/server/data/members";
import { listProjects } from "@/server/data/projects";
import { getTaskById } from "@/server/data/tasks";
import { taskParamsSchema } from "@/server/validation/tasks";
import { TaskForm } from "@/components/tasks/task-form";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

const PROJECT_OPTIONS_LIMIT = 200;

type Params = Promise<{ id: string }>;

export default async function EditTaskPage({ params }: { params: Params }) {
  const ctx = await requireContext();
  if (ctx.membership.role === "member") redirect("/tasks");

  const parsed = taskParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();

  const task = await getTaskById(ctx, parsed.data.id);
  if (!task) notFound();

  const [projects, members] = await Promise.all([
    listProjects(ctx, { limit: PROJECT_OPTIONS_LIMIT, offset: 0 }),
    listOrganizationMembers(ctx),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href={`/tasks/${task.id}`}
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-500 outline-none transition hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
          Back to task
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          Edit task
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Update the details for {task.title}.
        </p>
      </div>

      <Card className="p-6">
        <TaskForm
          action={updateTaskAction.bind(null, task.id)}
          defaults={{
            projectId: task.projectId,
            title: task.title,
            assigneeId: task.assigneeId ?? "",
            status: task.status,
            priority: task.priority,
            // Already a date-only string; passed through unchanged so the
            // displayed day cannot shift.
            dueDate: task.dueDate ?? "",
          }}
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
          }))}
          members={members.map((member) => ({
            userId: member.userId,
            name: member.name,
          }))}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          cancelHref={`/tasks/${task.id}`}
        />
      </Card>
    </div>
  );
}
