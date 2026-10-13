import Link from "next/link";
import { notFound } from "next/navigation";

import { requireContext } from "@/server/auth";
import { getClientById } from "@/server/data/clients";
import { countProjectsByClient } from "@/server/data/projects";
import { clientParamsSchema } from "@/server/validation/clients";
import { ClientStatusBadge } from "@/components/clients/clients-table";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function ClientDetailPage({ params }: { params: Params }) {
  const ctx = await requireContext();
  const canManage =
    ctx.membership.role === "owner" || ctx.membership.role === "admin";

  // The id is validated before it ever reaches the data layer.
  const parsed = clientParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();

  const client = await getClientById(ctx, parsed.data.id);
  if (!client) notFound();

  const projectCount = await countProjectsByClient(ctx, client.id);

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
          href="/clients"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-500 outline-none transition hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
          Back to clients
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
            {client.name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part.charAt(0).toUpperCase())
              .join("")}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {client.name}
              </h1>
              <ClientStatusBadge status={client.status} />
            </div>
            {client.company ? (
              <p className="mt-0.5 text-sm text-slate-500">{client.company}</p>
            ) : null}
          </div>
        </div>

        {canManage ? (
          <div className="flex items-center gap-2.5">
            <Link
              href={`/clients/${client.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            >
              Edit
            </Link>
            <DeleteClientButton
              clientId={client.id}
              clientName={client.name}
              projectCount={projectCount}
              variant="button"
            />
          </div>
        ) : null}
      </header>

      <Card>
        <CardHeader title="Client details" />
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Email
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {client.email ?? <span className="text-slate-400">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Company
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {client.company ?? <span className="text-slate-400">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Created
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {formatDate(client.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Last updated
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {formatDate(client.updatedAt)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Projects"
          description={`${projectCount} ${projectCount === 1 ? "project" : "projects"} belong${projectCount === 1 ? "s" : ""} to this client.`}
        />
        <CardContent>
          {projectCount === 0 ? (
            <p className="text-sm text-slate-500">
              No projects for {client.name} yet.
            </p>
          ) : (
            <Link
              href={`/projects?q=${encodeURIComponent(client.name)}`}
              className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-indigo-600 outline-none transition hover:text-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            >
              View projects for {client.name}
              <Icon name="chevronRight" className="h-4 w-4 rtl:rotate-180" />
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
