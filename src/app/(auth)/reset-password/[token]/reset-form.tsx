"use client";

import { useActionState } from "react";
import { toast } from "sonner";

import { Field, FormError, Input, SubmitButton } from "@/components/auth/form";
import {
  resetPasswordAction,
  type ResetPasswordState,
} from "@/server/actions/account-security";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(
    async (
      prev: ResetPasswordState,
      formData: FormData,
    ): Promise<ResetPasswordState> => {
      try {
        // resetPasswordAction redirects to /login on success — that redirect
        // is thrown across the server-action boundary as a NEXT_REDIRECT
        // digest, so capture it here as the success signal and acknowledge
        // once via a toast.
        await resetPasswordAction(prev, formData);
      } catch (error) {
        const digest = (error as { digest?: unknown }).digest;
        if (
          typeof digest === "string" &&
          digest.startsWith("NEXT_REDIRECT") &&
          digest.includes("/login")
        ) {
          toast.success("Password updated");
          throw error;
        }
        throw error;
      }
      return prev;
    },
    { status: "idle" } as ResetPasswordState,
  );

  if (state.status === "error" && state.formError) {
    // A consumed/expired token is a terminal state with no resubmit path.
    return (
      <div className="text-center">
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {state.formError}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Request a fresh reset link from the sign-in page.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.formError} />
      <input type="hidden" name="token" value={token} />

      <Field label="New password" error={state.fieldErrors?.newPassword}>
        <Input
          name="newPassword"
          type="password"
          required
          autoComplete="new-password"
          aria-invalid={state.fieldErrors?.newPassword ? true : undefined}
          aria-describedby="new-password-note"
        />
        <p id="new-password-note" className="text-xs text-slate-500">
          At least 8 characters.
        </p>
      </Field>

      <Field label="Confirm new password" error={state.fieldErrors?.confirmPassword}>
        <Input
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          aria-invalid={state.fieldErrors?.confirmPassword ? true : undefined}
        />
      </Field>

      <SubmitButton pendingLabel="Saving…">Set new password</SubmitButton>
    </form>
  );
}
