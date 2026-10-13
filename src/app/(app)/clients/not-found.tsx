import Link from "next/link";

import { EmptyState } from "@/components/app/empty-state";

/**
 * Shown when a client id does not resolve inside the current organization.
 * The message never distinguishes "deleted" from "belongs elsewhere" — no
 * cross-tenant existence is leaked.
 */
export default function ClientNotFound() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white">
      <EmptyState
        icon="clients"
        title="Client not found."
        description="This client may have been removed, or the link is outdated."
      >
        <Link
          href="/clients"
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2"
        >
          Back to clients
        </Link>
      </EmptyState>
    </div>
  );
}
