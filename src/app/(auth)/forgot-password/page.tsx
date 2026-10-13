import Link from "next/link";

import { ForgotForm } from "./forgot-form";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
            NexaFlow
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Forgot your password?
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Enter your account email and we&apos;ll send you reset instructions
            if an account exists.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <ForgotForm />
        </div>

        <p className="text-center text-sm text-slate-600">
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
