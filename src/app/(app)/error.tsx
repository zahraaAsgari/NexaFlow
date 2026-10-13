"use client";

import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary for the authenticated area. The message is
 * intentionally generic: the underlying error never reaches the user, so
 * database, session or tenant details cannot leak into the UI.
 */
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm"
    >
      <h2 className="text-base font-semibold text-slate-900">
        Something went wrong
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
        We couldn&apos;t load this part of your workspace. Please try again —
        if it keeps happening, sign out and sign back in.
      </p>
      <div className="mt-5 flex justify-center">
        <Button type="button" variant="secondary" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
