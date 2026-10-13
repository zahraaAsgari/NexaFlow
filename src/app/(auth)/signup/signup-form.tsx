"use client";

import { useActionState } from "react";

import type { AuthFormState } from "@/server/actions/auth";
import { Field, FormError, Input, SubmitButton } from "@/components/auth/form";

type Props = {
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  initialState: AuthFormState;
};

export function SignupForm({ action, initialState }: Props) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.formError} />

      <Field label="Full name" error={state.fieldErrors?.name}>
        <Input
          name="name"
          type="text"
          autoComplete="name"
          required
          placeholder="Ada Lovelace"
        />
      </Field>

      <Field
        label="Organization name"
        error={state.fieldErrors?.organizationName}
      >
        <Input
          name="organizationName"
          type="text"
          autoComplete="organization"
          required
          placeholder="Acme Studio"
        />
      </Field>

      <Field label="Email" error={state.fieldErrors?.email}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
        />
      </Field>

      <Field label="Password" error={state.fieldErrors?.password}>
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="At least 8 characters"
        />
      </Field>

      <SubmitButton pendingLabel="Creating your workspace…">
        Create account
      </SubmitButton>
    </form>
  );
}
