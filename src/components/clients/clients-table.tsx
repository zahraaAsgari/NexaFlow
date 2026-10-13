import Link from "next/link";

import type { Client } from "@/server/data/clients";
import { countProjectsByClient } from "@/server/data/projects";
import type { AuthContext } from "@/server/auth";
import { DeleteClientButton } from "./delete-client-button";

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ClientStatusBadge({ status }: { status: "active" | "archived" }) {
  return status === "active" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-500/20">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" />
      Archived
    </span>
  );
}

/** Renders rows for both the desktop table and the mobile card list. */
export async function ClientsList({
  clients,
  ctx,
  canManage,
}: {
  clients: Client[];
  ctx: AuthContext;
  canManage: boolean;
}) {
  // Project counts power the delete-cascade warning. One small query per
  // rendered row is acceptable for a 25-row page; a grouped count lands with
  // the Projects module if profiling ever shows it matters.
  const counts = await Promise.all(
    clients.map((client) => countProjectsByClient(ctx, client.id)),
  );
  const rows = clients.map((client, index) => ({
    client,
    projectCount: counts[index] ?? 0,
  }));

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-5 py-3">Name</th>
              <th scope="col" className="px-5 py-3">Email</th>
              <th scope="col" className="px-5 py-3">Company</th>
              <th scope="col" className="px-5 py-3">Status</th>
              <th scope="col" className="px-5 py-3">Created</th>
              <th scope="col" className="px-5 py-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ client, projectCount }) => (
              <tr key={client.id} className="transition hover:bg-slate-50/70">
                <td className="px-5 py-3.5">
                  <Link
                    href={`/clients/${client.id}`}
                    className="inline-flex items-center gap-3 rounded-md font-medium text-slate-900 outline-none hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                      {initials(client.name)}
                    </span>
                    <span className="truncate">{client.name}</span>
                  </Link>
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {client.email ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {client.company ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="px-5 py-3.5">
                  <ClientStatusBadge status={client.status} />
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {formatDate(client.createdAt)}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {canManage ? (
                      <>
                        <Link
                          href={`/clients/${client.id}/edit`}
                          className="rounded-md px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                        >
                          Edit
                        </Link>
                        <DeleteClientButton
                          clientId={client.id}
                          clientName={client.name}
                          projectCount={projectCount}
                        />
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">View only</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 lg:hidden">
        {rows.map(({ client, projectCount }) => (
          <li
            key={client.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                {initials(client.name)}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/clients/${client.id}`}
                  className="rounded-md font-medium text-slate-900 outline-none hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                >
                  {client.name}
                </Link>
                {client.company ? (
                  <p className="truncate text-sm text-slate-500">
                    {client.company}
                  </p>
                ) : null}
                {client.email ? (
                  <p className="truncate text-sm text-slate-500">
                    {client.email}
                  </p>
                ) : null}
              </div>
              <ClientStatusBadge status={client.status} />
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
              <span>Created {formatDate(client.createdAt)}</span>
              {canManage ? (
                <span className="flex items-center gap-1.5">
                  <Link
                    href={`/clients/${client.id}/edit`}
                    className="rounded-md px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                  >
                    Edit
                  </Link>
                  <DeleteClientButton
                    clientId={client.id}
                    clientName={client.name}
                    projectCount={projectCount}
                  />
                </span>
              ) : (
                <span>View only</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
