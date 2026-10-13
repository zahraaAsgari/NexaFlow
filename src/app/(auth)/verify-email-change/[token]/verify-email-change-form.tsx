"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormError, SubmitButton } from "@/components/auth/form";
import {
  verifyEmailChangeAction,
  type VerifyEmailChangeState,
} from "@/server/actions/account-security";
import { securityTokenSchema } from "@/server/validation/security";

export function VerifyEmailChangeForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(verifyEmailChangeAction, {
    status: "idle",
  } as VerifyEmailChangeState);

  if (state.status === "error" && state.formError) {
    return (
      <div className="text-center">
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {state.formError}
        </p>
        <Link
          href="/account"
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          Back to Account
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.formError} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton pendingLabel="Confirming…">Confirm new email</SubmitButton>
    </form>
  );
}
