"use client";

import { useActionState } from "react";

import type { AuthFormState } from "@/server/actions/auth";
import { Field, FormError, Input, SubmitButton } from "@/components/auth/form";

type Props = {
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  initialState: AuthFormState;
};

export function LoginForm({ action, initialState }: Props) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate={false}>
      <FormError message={state.formError} />

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
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </Field>

      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
