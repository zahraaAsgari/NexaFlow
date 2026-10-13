/**
 * NexaFlow logo component.
 *
 * Uses the generated public/icon.png as the visual mark alongside the
 * wordmark. Used on the public landing page header/footer. The in-app
 * sidebar continues to use the inline SVG Brand component
 * (src/components/app/brand.tsx) for consistency with the dashboard.
 */
export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/icon.png"
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-lg"
      />
      <span className="text-base font-semibold tracking-tight text-slate-900">
        NexaFlow
      </span>
    </div>
  );
}
