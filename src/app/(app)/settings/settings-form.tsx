"use client";

import { useActionState } from "react";
import { toast } from "sonner";

import { Field, FormError, Input, SubmitButton } from "@/components/auth/form";
import { updateOrganizationSettingsAction, type SettingsFormState } from "@/server/actions/settings";

/**
 * Organization profile form. Only the organization name is editable; the slug
 * is shown read-only and regenerated server-side from the name (collision-safe.
 * The identity of the organization being edited is entirely server-side
 * (requireContext), so nothing here accepts an organization ID.
 */
export function SettingsForm({
  defaults,
}: {
  defaults: { name: string; slug: string };
}) {
  const [state, formAction] = useActionState(
    async (prev: SettingsFormState, formData: FormData) => {
      const result = await updateOrganizationSettingsAction(prev, formData);
      if (result.status === "saved") {
        toast.success("Changes saved");
      }
      return result;
    },
    { status: "idle" } as SettingsFormState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.formError} />

      <Field label="Organization name" error={state.fieldErrors?.name}>
        <Input
          name="name"
          type="text"
          required
          maxLength={100}
          defaultValue={defaults.name}
          aria-invalid={state.fieldErrors?.name ? true : undefined}
          aria-describedby="org-name-note"
        />
        <p id="org-name-note" className="text-xs text-slate-500">
          Shown throughout your workspace: sidebar, dashboard, team.
        </p>
      </Field>

      <Field label="Organization slug">
        <div className="flex items-center gap-2">
          <Input value={defaults.slug} readOnly disabled aria-describedby="org-slug-note" className="font-mono text-sm" />
        </div>
        <p id="org-slug-note" className="text-xs text-slate-500">
          Internal identifier, updated automatically from the name. It is never
          used in URLs.
        </p>
      </Field>

      <div className="pt-1">
        <span className="sm:w-48 inline-block">
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </span>
      </div>
    </form>
  );
}
