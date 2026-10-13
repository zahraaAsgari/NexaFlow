"use client";

import Link from "next/link";

import { Field, Input, SubmitButton } from "@/components/auth/form";
import {
  forgotPasswordAction,
  type ForgotPasswordState,
} from "@/server/actions/account-security";
import { useActionState } from "react";

export function ForgotForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, {
    status: "idle",
  } as ForgotPasswordState);

  if (state.status === "done") {
    return (
      <div className="space-y-5">
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
          If an account exists for that email address, you&apos;ll receive
          instructions to reset your password shortly.
        </p>
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.status === "error" && state.formError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {state.formError}
        </p>
      ) : null}

      <Field label="Email">
        <Input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@company.com"
        />
      </Field>

      <SubmitButton pendingLabel="Sending…">Send reset instructions</SubmitButton>
    </form>
  );
}
