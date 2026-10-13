import Link from "next/link";

import { EmptyState } from "@/components/app/empty-state";

export default function TeamMemberNotFound() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white">
      <EmptyState
        icon="users"
        title="Member not found."
        description="This person may no longer be a member of this organization."
      >
        <Link
          href="/team"
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2"
        >
          Back to team
        </Link>
      </EmptyState>
    </div>
  );
}
