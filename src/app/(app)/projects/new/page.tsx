import Link from "next/link";
import { redirect } from "next/navigation";

import { requireContext } from "@/server/auth";
import { createProjectAction } from "@/server/actions/projects";
import { listClients } from "@/server/data/clients";
import { ProjectForm } from "@/components/projects/project-form";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Upper bound for the selector; large workspaces are noted as a limitation. */
const CLIENT_OPTIONS_LIMIT = 200;

export default async function NewProjectPage() {
  const ctx = await requireContext();
  // Members cannot manage projects; the server action enforces the same rule.
  if (ctx.membership.role === "member") redirect("/projects");

  // Tenant-safe: only this organization's clients can populate the selector.
  const clients = await listClients(ctx, {
    limit: CLIENT_OPTIONS_LIMIT,
    offset: 0,
  });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-500 outline-none transition hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
          Back to projects
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          New project
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Add a project to {ctx.organization.name}.
        </p>
      </div>

      {clients.length === 0 ? (
        <Card>
          <EmptyState
            icon="clients"
            title="Add a client first."
            description="Every project belongs to a client, so create a client before starting a project."
          >
            <Link
              href="/clients/new"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2"
            >
              <Icon name="plus" className="h-4 w-4" />
              Create a client
            </Link>
          </EmptyState>
        </Card>
      ) : (
        <Card className="p-6">
          <ProjectForm
            action={createProjectAction}
            defaults={{
              clientId: "",
              name: "",
              description: "",
              status: "active",
            }}
            clients={clients.map((client) => ({
              id: client.id,
              name: client.name,
            }))}
            submitLabel="Create project"
            pendingLabel="Creating…"
            cancelHref="/projects"
            showStatus={false}
          />
        </Card>
      )}
    </div>
  );
}
