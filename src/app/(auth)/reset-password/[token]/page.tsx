import Link from "next/link";

import { securityTokenSchema } from "@/server/validation/security";
import { ResetForm } from "./reset-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ token: string }>;

/**
 * Password reset confirmation. The token is validated for shape only on load
 * — never consumed here; consumption happens solely when the user submits the
 * new password (so email pre-fetch scanners can never burn a valid link).
 */
export default async function ResetPasswordPage({ params }: { params: Params }) {
  const { token } = await params;
  const tokenOk = securityTokenSchema.safeParse(token).success;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
            NexaFlow
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Set a new password
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {tokenOk
              ? "Choose a strong new password for your account."
              : "This reset link is no longer valid."}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {tokenOk ? (
            <ResetForm token={token} />
          ) : (
            <div className="text-center">
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                This reset link is no longer valid.
              </p>
              <Link
                href="/forgot-password"
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
              >
                Request a new link
              </Link>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-slate-600">
          <Link
            href="/login"
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
