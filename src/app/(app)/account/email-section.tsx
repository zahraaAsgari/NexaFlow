"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Icon, type IconName } from "@/components/icons";
import { Field, Input, SubmitButton } from "@/components/auth/form";
import { CardFooter } from "@/components/ui/card";
import {
  requestEmailChangeAction,
  resendVerificationEmailAction,
  type RequestEmailChangeState,
  type ResendVerificationState,
} from "@/server/actions/account-security";

/**
 * Account email section. Authenticated operations only; the new email is
 * verified at the NEW address before users.email ever changes (instead of the
 * honest-but-weak immediate change from before).
 */
export function EmailSection({
  email,
  verified,
  pendingNewEmail,
}: {
  email: string;
  verified: boolean;
  pendingNewEmail: string | null;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{email}</p>
          {pendingNewEmail ? (
            <p className="font-mono text-xs text-amber-700">
              Verification pending for {pendingNewEmail}
            </p>
          ) : null}
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
            verified
              ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
              : "bg-amber-50 text-amber-700 ring-amber-600/20"
          }`}
        >
          <Icon
            name={verified ? "check" : "close"}
            className="h-3.5 w-3.5"
          />
          {verified ? "Verified" : "Not verified"}
        </span>
      </div>

      {pendingNewEmail ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          A verification link was sent to <strong>{pendingNewEmail}</strong>.
          Open it to finish the change — your current email stays active until then.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <ResendVerificationButton verified={verified} />
        <ChangeEmailForms verified={verified} currentEmail={email} />
      </div>
    </div>
  );
}

function ResendVerificationButton({ verified }: { verified: boolean }) {
  const router = useRouter();
  const [state, formAction] = useActionState(resendVerificationEmailAction, {
    status: "idle",
  } as ResendVerificationState);

  useEffect(() => router.refresh(), [state.status, router]);

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-900">Verification email</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {verified
          ? "Your email is already verified."
          : "Get a fresh verification link at this address."}
      </p>
      {state.status === "sent" || state.status === "unavailable" || state.status === "already_verified" ? (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            state.status === "sent"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {state.status === "sent"
            ? "Verification email sent."
            : state.status === "unavailable"
              ? "Couldn't send the email right now — try again shortly."
              : "This email is already verified."}
        </p>
      ) : null}
      <span className="mt-3 inline-block w-full">
        <button
          type="submit"
          disabled={verified || state.status === "sent"}
          className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {verified ? "Verified" : "Resend verification email"}
        </button>
      </span>
    </form>
  );
}

function ChangeEmailForms({
  verified,
  currentEmail,
}: {
  verified: boolean;
  currentEmail: string;
}) {
  const [state, formAction] = useActionState(requestEmailChangeAction, {
    status: "idle",
  } as RequestEmailChangeState);
  const router = useRouter();
  useEffect(() => router.refresh(), [state.status, router]);

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-900">Change email address</p>
      <p className="mt-0.5 text-xs text-slate-500">
        The new address must be verified before it replaces {currentEmail}.
      </p>

      {state.status === "sent" || state.status === "unavailable" ? (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            state.status === "sent"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {state.status === "sent"
            ? "Verification sent to the new address."
            : "Couldn't send the verification right now — try again shortly."}
        </p>
      ) : null}
      {state.status === "error" && state.formError ? (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.formError}
        </p>
      ) : null}

      <div className="mt-3 space-y-3">
        <Field label="New email" error={state.fieldErrors?.email}>
          <Input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            placeholder="new-address@company.com"
            aria-invalid={state.fieldErrors?.email ? true : undefined}
          />
        </Field>
        <span className="inline-block w-full">
          <SubmitButton pendingLabel="Sending…">Send verification</SubmitButton>
        </span>
      </div>
    </form>
  );
}

export function AboutEmailSecurityCardFooter() {
  return (
    <CardFooter>
      <p className="text-sm text-slate-600">
        Verify a new email address before it replaces your current one. Your current email stays
        fully active until you confirm the change.
      </p>
    </CardFooter>
  );
}
