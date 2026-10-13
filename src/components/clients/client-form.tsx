"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, FormError, Input, SubmitButton } from "@/components/auth/form";
import type { ClientFormState } from "@/server/actions/clients";

export type ClientFormDefaults = {
  name: string;
  email: string;
  company: string;
  status: "active" | "archived";
};

type Props = {
  action: (prev: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  defaults: ClientFormDefaults;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  /** Status is only editable for existing clients. */
  showStatus: boolean;
};

/** Shared create/edit form; server action remains the sole authority. */
export function ClientForm({
  action,
  defaults,
  submitLabel,
  pendingLabel,
  cancelHref,
  showStatus,
}: Props) {
  const [state, formAction] = useActionState(action, { status: "idle" });

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.formError} />

      <Field label="Name" error={state.fieldErrors?.name}>
        <Input
          id="client-name"
          name="name"
          type="text"
          required
          maxLength={100}
          defaultValue={defaults.name}
          autoComplete="organization"
          placeholder="e.g. Acme Studio"
          aria-invalid={state.fieldErrors?.name ? true : undefined}
        />
      </Field>

      <Field label="Email" error={state.fieldErrors?.email}>
        <Input
          id="client-email"
          name="email"
          type="email"
          maxLength={254}
          defaultValue={defaults.email}
          placeholder="name@company.com (optional)"
          aria-invalid={state.fieldErrors?.email ? true : undefined}
        />
      </Field>

      <Field label="Company" error={state.fieldErrors?.company}>
        <Input
          id="client-company"
          name="company"
          type="text"
          maxLength={100}
          defaultValue={defaults.company}
          placeholder="Company or organization (optional)"
          aria-invalid={state.fieldErrors?.company ? true : undefined}
        />
      </Field>

      {showStatus ? (
        <Field label="Status" error={state.fieldErrors?.status}>
          <select
            id="client-status"
            name="status"
            defaultValue={defaults.status}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
      ) : null}

      <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:justify-between">
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
        <Link
          href={cancelHref}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
