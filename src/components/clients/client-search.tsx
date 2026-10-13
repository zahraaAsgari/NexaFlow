import { Icon } from "@/components/icons";

/**
 * Server-side search rendered as a plain GET form (progressive enhancement —
 * works without JavaScript). The query string is only a filter; the tenant
 * scope is resolved server-side from the authenticated context.
 */
export function ClientSearch({ q }: { q: string }) {
  return (
    <form method="get" action="/clients" role="search" className="max-w-md flex-1">
      <label htmlFor="client-search" className="sr-only">
        Search clients
      </label>
      <div className="relative">
        <Icon
          name="search"
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          id="client-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by name, email or company…"
          maxLength={100}
          autoComplete="off"
          className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 ps-9 pe-24 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
        />
        <button
          type="submit"
          className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          Search
        </button>
      </div>
    </form>
  );
}
