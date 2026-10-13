import Link from "next/link";

import { EmptyState } from "@/components/app/empty-state";

/**
 * Shown when the active organization cannot be resolved for settings. This
 * should be rare (active org is session-derived), but the guard stays in place
 * so a stale session can never surface a mutated tenant context.
 */
export default function SettingsNotFound() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white">
      <EmptyState
        icon="settings"
        title="Organization unavailable."
        description="This workspace couldn't be loaded. Try signing in again."
      >
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2"
        >
          Back to dashboard
        </Link>
      </EmptyState>
    </div>
  );
}
