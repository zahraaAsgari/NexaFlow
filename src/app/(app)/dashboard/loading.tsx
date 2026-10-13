/** Streaming skeleton matching the real dashboard structure. */
export default function DashboardLoading() {
  return (
    <div className="space-y-9">
      <div className="space-y-2">
        <div className="h-7 w-72 animate-pulse rounded-md bg-slate-200" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-slate-100" />
      </div>

      <div className="h-12 animate-pulse rounded-lg bg-slate-100" />

      <div className="space-y-3">
        <div className="h-5 w-24 animate-pulse rounded-md bg-slate-100" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((card) => (
            <div
              key={card}
              className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((card) => (
          <div
            key={card}
            className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white"
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((card) => (
          <div
            key={card}
            className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    </div>
  );
}
