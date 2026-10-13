/** Streaming skeleton matching the clients list layout. */
export default function ClientsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-36 animate-pulse rounded-md bg-slate-200" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-slate-100" />
      </div>
      <div className="h-10 max-w-md animate-pulse rounded-lg bg-slate-100" />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {[0, 1, 2, 3, 4].map((row) => (
          <div
            key={row}
            className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 last:border-0"
          >
            <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
            <div className="h-4 w-40 animate-pulse rounded-md bg-slate-100" />
            <div className="ms-auto h-4 w-24 animate-pulse rounded-md bg-slate-50" />
          </div>
        ))}
      </div>
    </div>
  );
}
