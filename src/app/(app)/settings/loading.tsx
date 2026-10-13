/** Streaming skeleton matching the organization settings layout. */
export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-md bg-slate-200" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-slate-100" />
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="h-4 w-40 animate-pulse rounded-md bg-slate-100" />
        </div>
        <div className="space-y-5 px-5 py-5">
          {[0, 1].map((field) => (
            <div key={field} className="space-y-2">
              <div className="h-3 w-28 animate-pulse rounded-md bg-slate-100" />
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ))}
          <div className="h-10 w-36 animate-pulse rounded-lg bg-slate-200" />
        </div>
      </div>
      <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
    </div>
  );
}
