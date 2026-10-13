import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
          NexaFlow
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          The page you were looking for doesn&apos;t exist or isn&apos;t
          available yet.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2"
        >
          Go to your workspace
        </Link>
      </div>
    </main>
  );
}
