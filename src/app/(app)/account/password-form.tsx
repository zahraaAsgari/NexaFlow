"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Field, FormError, Input, SubmitButton } from "@/components/auth/form";
import {
  changeAccountPasswordAction,
  type PasswordChangeState,
} from "@/server/actions/account";

/**
 * Change password. Requires the current password (a second factor) plus the
 * new password and its confirmation. Fields are cleared after a successful
 * change so the new secret is never left in the DOM. Messages are always
 * generic; nothing reveals the stored hash or why verification failed beyond
 * the current password being wrong.
 */
export function AccountPasswordForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    async (prev: PasswordChangeState, formData: FormData) => {
      const result = await changeAccountPasswordAction(prev, formData);
      if (result.status === "saved") {
        toast.success(
          "Password updated. All other sign-ins were ended — you stayed signed in here.",
        );
        formRef.current?.reset();
        router.refresh();
      }
      return result;
    },
    { status: "idle" } as PasswordChangeState,
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <FormError message={state.formError} />

      <Field label="Current password" error={state.fieldErrors?.currentPassword}>
        <Input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={state.fieldErrors?.currentPassword ? true : undefined}
        />
      </Field>

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

      <div className="pt-1">
        <span className="inline-block sm:w-44">
          <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
        </span>
      </div>
    </form>
  );
}
