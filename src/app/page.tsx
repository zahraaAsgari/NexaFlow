import Link from "next/link";

import { getCurrentAuth } from "@/server/auth";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "NexaFlow — Business operations workspace",
  description:
    "Manage clients, projects, and tasks with your team in a single multi-tenant workspace. Built for agencies and service businesses.",
};

/**
 * Public landing page.
 *
 * Every claim below reflects a feature that is implemented and tested in
 * this repository. No invented customers, testimonials, statistics, or
 * integrations.
 */
export default async function LandingPage() {
  const auth = await getCurrentAuth();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-3">
            {auth ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                >
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Run your client work in one place
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              NexaFlow brings your clients, projects, and tasks into a single
              workspace your whole team can share — without spreadsheets
              scattered across inboxes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-500 sm:w-auto"
              >
                Create your workspace
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Free to start. Your first organization is created with your
              account.
            </p>
          </div>
        </section>

        {/* Feature grid — only implemented features */}
        <section className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
              What you get
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <Feature
                title="Client management"
                description="Keep every client relationship in one place with contact details and company information."
              />
              <Feature
                title="Project tracking"
                description="Organize projects under their clients with status tracking from active to completed."
              />
              <Feature
                title="Task collaboration"
                description="Assign tasks to team members, set priorities and due dates, and track progress."
              />
              <Feature
                title="Team workspace"
                description="Invite team members by email with owner, admin, and member roles."
              />
              <Feature
                title="Secure by design"
                description="Encrypted passwords, protected sessions, and strict organization isolation."
              />
              <Feature
                title="Real-time overview"
                description="See live counts of clients, projects, and tasks on your dashboard."
              />
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="border-t border-slate-200">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Built for teams that manage client work
              </h2>
              <p className="mt-4 text-base text-slate-600">
                NexaFlow is designed for agencies, consultancies, studios, and
                any service business that needs to track work across multiple
                clients and team members without juggling separate tools.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Logo />
            <p className="text-sm text-slate-400">
              Business operations workspace
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
    </div>
  );
}
