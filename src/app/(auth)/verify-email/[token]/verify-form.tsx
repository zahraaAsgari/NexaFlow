"use client";

import Link from "next/link";
import { useActionState } from "react";
import { toast } from "sonner";

import { FormError, SubmitButton } from "@/components/auth/form";
import {
  verifyEmailAction,
  type VerifyEmailState,
} from "@/server/actions/account-security";

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(verifyEmailAction, {
    status: "idle",
  } as VerifyEmailState);

  if (state.status === "already_verified") {
    return (
      <div className="text-center">
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
          Your email was already verified.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
          onClick={() => toast.success("Email verified")}
        >
          Continue to NexaFlow
        </Link>
      </div>
    );
  }

  if (state.status === "error" && state.formError) {
    return (
      <div className="text-center">
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {state.formError}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          You can request a fresh verification link from your Account page.
        </p>
        <Link
          href="/account"
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          Go to Account
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.formError} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton pendingLabel="Verifying…">Verify email address</SubmitButton>
    </form>
  );
}
