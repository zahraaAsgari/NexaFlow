import Link from "next/link";
import { notFound } from "next/navigation";

import { requireContext } from "@/server/auth";
import {
  CLIENTS_PAGE_SIZE,
  countClients,
  listClients,
} from "@/server/data/clients";
import { clientsSearchParamsSchema } from "@/server/validation/clients";
import { FeatureNotice } from "@/components/notifications/feature-notice";
import { ClientSearch } from "@/components/clients/client-search";
import { ClientsList } from "@/components/clients/clients-table";
import { EmptyState } from "@/components/app/empty-state";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requireContext();
  const canManage =
    ctx.membership.role === "owner" || ctx.membership.role === "admin";

  const raw = await searchParams;
  const parsed = clientsSearchParamsSchema.safeParse({
    q: typeof raw.q === "string" ? raw.q : "",
    page: typeof raw.page === "string" ? raw.page : undefined,
  });
  const q = parsed.success ? parsed.data.q : "";
  const requestedPage = parsed.success ? parsed.data.page : 1;

  const total = await countClients(ctx, q || undefined);
  const totalPages = Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const rows = await listClients(ctx, {
    q: q || undefined,
    limit: CLIENTS_PAGE_SIZE,
    offset: (page - 1) * CLIENTS_PAGE_SIZE,
  });

  const orgTotal = q ? await countClients(ctx) : total;

  return (
    <div className="space-y-6">
      <FeatureNotice
        entity="clients"
        labels={{
          created: "Client created",
          updated: "Client updated",
          deleted: "Client deleted",
        }}
      />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Clients
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage the customers belonging to your workspace.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ClientSearch q={q} />
        {canManage ? (
          <Link
            href="/clients/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2"
          >
            <Icon name="plus" className="h-4 w-4" />
            New client
          </Link>
        ) : null}
      </div>

      {total === 0 && !q ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white">
          <EmptyState
            icon="clients"
            title="No clients yet."
            description={
              canManage
                ? "Add your first client to start organizing work in this workspace."
                : "This workspace doesn't have any clients yet."
            }
          >
            {canManage ? (
              <Link
                href="/clients/new"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2"
              >
                <Icon name="plus" className="h-4 w-4" />
                Create your first client
              </Link>
            ) : null}
          </EmptyState>
        </div>
      ) : total === 0 && q ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white">
          <EmptyState
            icon="search"
            title="No clients match your search."
            description={`Nothing in ${ctx.organization.name} matches that search.`}
          >
            <Link
              href="/clients"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            >
              Clear search
            </Link>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2 text-sm text-slate-500">
            <p>
              {q
                ? `${total} ${total === 1 ? "result" : "results"} for that search of ${orgTotal} clients`
                : `${total} ${total === 1 ? "client" : "clients"}`}
            </p>
          </div>

          <ClientsList clients={rows} ctx={ctx} canManage={canManage} />

          {totalPages > 1 ? (
            <nav
              aria-label="Clients pagination"
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
            >
              {page > 1 ? (
                <PaginationLink q={q} page={page - 1} label="Previous" />
              ) : (
                <span className="text-slate-300">Previous</span>
              )}
              <span className="text-slate-500">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <PaginationLink q={q} page={page + 1} label="Next" />
              ) : (
                <span className="text-slate-300">Next</span>
              )}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

function PaginationLink({
  q,
  page,
  label,
}: {
  q: string;
  page: number;
  label: string;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  return (
    <Link
      href={`/clients?${params.toString()}`}
      className="rounded-md px-2 py-1 font-medium text-indigo-600 outline-none hover:text-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
    >
      {label}
    </Link>
  );
}
