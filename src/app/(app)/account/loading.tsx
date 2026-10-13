/** Streaming skeleton matching the Account page layout. */
export default function AccountLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-32 animate-pulse rounded-md bg-slate-200" />
        <div className="h-4 w-80 animate-pulse rounded-md bg-slate-100" />
      </div>
      <div className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white" />
      {[0, 1].map((card) => (
        <div
          key={card}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
        >
          <div className="h-4 w-40 animate-pulse rounded-md bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 w-40 animate-pulse rounded-lg bg-slate-200" />
        </div>
      ))}
    </div>
  );
}
