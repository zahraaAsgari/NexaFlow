"use client";

import { useActionState } from "react";

import { Field, FormError, Input, SubmitButton } from "@/components/auth/form";
import {
  acceptInvitationAction,
  acceptInvitationWithAccountAction,
  type AcceptState,
} from "@/server/actions/invitations";

/** One-click acceptance for a recipient who is already signed in correctly. */
export function AcceptAsCurrentUser({ token }: { token: string }) {
  const [state, formAction] = useActionState(acceptInvitationAction, {
    status: "idle",
  } as AcceptState);

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.formError} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton pendingLabel="Joining…">Accept invitation</SubmitButton>
    </form>
  );
}

/** Account creation for a recipient with no NexaFlow account yet. */
export function AcceptWithNewAccount({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, formAction] = useActionState(
    acceptInvitationWithAccountAction,
    { status: "idle" } as AcceptState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.formError} />
      <input type="hidden" name="token" value={token} />

      <Field label="Email">
        <Input value={email} readOnly disabled aria-describedby="email-note" />
        <p id="email-note" className="text-xs text-slate-500">
          Your account will use the invited address.
        </p>
      </Field>

      <Field label="Full name" error={state.fieldErrors?.name}>
        <Input
          name="name"
          type="text"
          required
          maxLength={100}
          autoComplete="name"
          placeholder="Ada Lovelace"
          aria-invalid={state.fieldErrors?.name ? true : undefined}
        />
      </Field>

      <Field label="Password" error={state.fieldErrors?.password}>
        <Input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="At least 8 characters"
          aria-invalid={state.fieldErrors?.password ? true : undefined}
        />
      </Field>

      <SubmitButton pendingLabel="Creating account…">
        Create account &amp; join
      </SubmitButton>
    </form>
  );
}
