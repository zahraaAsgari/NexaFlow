"use client";

import { useActionState } from "react";
import { toast } from "sonner";

import { Field, FormError, Input, SubmitButton } from "@/components/auth/form";
import {
  updateAccountProfileAction,
  type AccountFormState,
} from "@/server/actions/account";

/**
 * Profile edit (name + email) for the signed-in user. Shows a transient
 * "saved" confirmation and refreshes the server-rendered identity everywhere.
 * Personal identity comes from the trusted auth context on the server — no
 * user id travels in the form.
 */
export function AccountProfileForm({
  defaults,
}: {
  defaults: { name: string };
}) {
  const [state, formAction] = useActionState(
    async (prev: AccountFormState, formData: FormData) => {
      const result = await updateAccountProfileAction(prev, formData);
      if (result.status === "saved") {
        toast.success("Profile updated");
      }
      return result;
    },
    { status: "idle" } as AccountFormState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.formError} />

      <Field label="Full name" error={state.fieldErrors?.name}>
        <Input
          name="name"
          type="text"
          required
          maxLength={100}
          defaultValue={defaults.name}
          aria-invalid={state.fieldErrors?.name ? true : undefined}
        />
      </Field>

      <div className="pt-1">
        <span className="inline-block sm:w-44">
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </span>
      </div>
    </form>
  );
}
