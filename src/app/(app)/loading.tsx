/**
 * Streaming skeleton for the authenticated area. Blocks mirror the shell
 * (sidebar, header, content) so navigation never shifts layout once loaded.
 */
export default function AppLoading() {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <div className="hidden lg:block lg:w-64 lg:shrink-0 lg:border-e lg:border-slate-200">
        <div className="space-y-4 p-5">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-14 animate-pulse rounded-lg bg-slate-100" />
          <div className="space-y-2 pt-2">
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                className="h-9 animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="h-14 animate-pulse border-b border-slate-200 bg-white" />
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="space-y-2">
            <div className="h-7 w-64 animate-pulse rounded-md bg-slate-200" />
            <div className="h-4 w-80 animate-pulse rounded-md bg-slate-100" />
          </div>
          <div className="h-14 animate-pulse rounded-lg bg-slate-100" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((card) => (
              <div
                key={card}
                className="h-52 animate-pulse rounded-xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
