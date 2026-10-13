import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireContext } from "@/server/auth";
import { updateProjectAction } from "@/server/actions/projects";
import { listClients } from "@/server/data/clients";
import { getProjectById } from "@/server/data/projects";
import { projectParamsSchema } from "@/server/validation/projects";
import { ProjectForm } from "@/components/projects/project-form";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

const CLIENT_OPTIONS_LIMIT = 200;

type Params = Promise<{ id: string }>;

export default async function EditProjectPage({ params }: { params: Params }) {
  const ctx = await requireContext();
  if (ctx.membership.role === "member") redirect("/projects");

  const parsed = projectParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();

  const project = await getProjectById(ctx, parsed.data.id);
  if (!project) notFound();

  const clients = await listClients(ctx, {
    limit: CLIENT_OPTIONS_LIMIT,
    offset: 0,
  });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-500 outline-none transition hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
          Back to project
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          Edit project
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Update the details for {project.name}.
        </p>
      </div>

      <Card className="p-6">
        <ProjectForm
          action={updateProjectAction.bind(null, project.id)}
          defaults={{
            clientId: project.clientId,
            name: project.name,
            description: project.description ?? "",
            status: project.status,
          }}
          clients={clients.map((client) => ({
            id: client.id,
            name: client.name,
          }))}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          cancelHref={`/projects/${project.id}`}
          showStatus
        />
      </Card>
    </div>
  );
}
