/**
 * Brand block shared by the desktop sidebar and the mobile drawer.
 * Uses the generated logo mark alongside the wordmark.
 */
export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/icon.png"
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-lg"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold tracking-tight text-slate-900">
          NexaFlow
        </span>
        <span className="block truncate text-[11px] text-slate-400">
          Business operations
        </span>
      </span>
    </div>
  );
}
