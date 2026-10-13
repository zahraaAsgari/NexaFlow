"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, FormError, Input, SubmitButton } from "@/components/auth/form";
import type { ProjectFormState } from "@/server/actions/projects";
import type { ClientOption } from "./types";

export type ProjectFormDefaults = {
  clientId: string;
  name: string;
  description: string;
  status: "active" | "completed" | "archived";
};

type Props = {
  action: (
    prev: ProjectFormState,
    formData: FormData,
  ) => Promise<ProjectFormState>;
  defaults: ProjectFormDefaults;
  /** Clients of the ACTIVE organization only — resolved server-side. */
  clients: ClientOption[];
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  /** Status is only editable for existing projects. */
  showStatus: boolean;
};

const fieldClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Shared create/edit form. The client selector lists only the organization's
 * own clients, but that is a UX restriction — the server action independently
 * re-verifies the submitted clientId against the authenticated tenant.
 */
export function ProjectForm({
  action,
  defaults,
  clients,
  submitLabel,
  pendingLabel,
  cancelHref,
  showStatus,
}: Props) {
  const [state, formAction] = useActionState(action, { status: "idle" });

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.formError} />

      <Field label="Client" error={state.fieldErrors?.clientId}>
        <select
          id="project-client"
          name="clientId"
          required
          defaultValue={defaults.clientId}
          aria-invalid={state.fieldErrors?.clientId ? true : undefined}
          aria-describedby={
            state.fieldErrors?.clientId ? "project-client-error" : undefined
          }
          className={fieldClass}
        >
          <option value="">Select a client…</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Project name" error={state.fieldErrors?.name}>
        <Input
          id="project-name"
          name="name"
          type="text"
          required
          maxLength={120}
          defaultValue={defaults.name}
          placeholder="e.g. Website redesign"
          aria-invalid={state.fieldErrors?.name ? true : undefined}
        />
      </Field>

      <Field label="Description" error={state.fieldErrors?.description}>
        <textarea
          id="project-description"
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={defaults.description}
          placeholder="What is this project about? (optional)"
          aria-invalid={state.fieldErrors?.description ? true : undefined}
          className={fieldClass}
        />
      </Field>

      {showStatus ? (
        <Field label="Status" error={state.fieldErrors?.status}>
          <select
            id="project-status"
            name="status"
            defaultValue={defaults.status}
            className={fieldClass}
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
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
