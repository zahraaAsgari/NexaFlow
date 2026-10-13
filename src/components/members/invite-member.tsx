"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Field, FormError, Input, SubmitButton } from "@/components/auth/form";
import { Icon } from "@/components/icons";
import {
  inviteMemberAction,
  type InviteFormState,
} from "@/server/actions/invitations";
import { INVITABLE_ROLES } from "@/server/validation/invitations";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  member: "Member",
};

/**
 * Invite dialog (native <dialog>, matching the Projects/Tasks pattern).
 *
 * The invitation is created and persisted, and the transactional email is
 * attempted after persist via the server-only email infrastructure (result in
 * `state.delivery`). The associated link is shown ONCE to the owner who
 * created it — the database stores only its hash, so it can never be shown
 * again. It is never presented as delivered unless the provider accepted it.
 */
export function InviteMemberButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [state, formAction] = useActionState(
    async (prev: InviteFormState, formData: FormData) => {
      const result = await inviteMemberAction(prev, formData);
      if (result.status === "created") {
        if (result.delivery === "sent") {
          toast.success("Invitation sent");
        } else {
          toast.success("Invitation created");
        }
      }
      return result;
    },
    { status: "idle" } as InviteFormState,
  );

  function open() {
    setCopied(false);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
    router.refresh();
  }

  const fullUrl =
    state.status === "created" && state.inviteUrl
      ? `${typeof window !== "undefined" ? window.location.origin : ""}${state.inviteUrl}`
      : "";

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2"
      >
        <Icon name="plus" className="h-4 w-4" />
        Invite member
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Invite a member"
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        className="fixed inset-0 m-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/45"
      >
        <div className="p-6">
          {state.status === "created" ? (
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Invitation created
              </h2>
              {state.delivery === "sent" ? (
                <p className="mt-1 text-sm text-slate-600">
                  An email with the invitation link was sent to{" "}
                  <strong className="font-semibold">{state.invitedEmail}</strong>.
                  This link is shown to you only once as a backup and expires in 7 days.
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-600">
                  The email couldn&apos;t be delivered
                  {state.delivery === "unavailable" ? " right now" : ""}, so share
                  this link with{" "}
                  <strong className="font-semibold">{state.invitedEmail}</strong>{" "}
                  yourself. It is shown only once and expires in 7 days.
                </p>
              )}

              <div className="mt-4 flex items-stretch gap-2">
                <input
                  readOnly
                  value={fullUrl}
                  aria-label="Invitation link"
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(fullUrl);
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                  className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form action={formAction} className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Invite a member
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  They&apos;ll join this organization with the role you choose.
                </p>
              </div>

              <FormError message={state.formError} />

              <Field label="Email" error={state.fieldErrors?.email}>
                <Input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  placeholder="teammate@company.com"
                  aria-invalid={state.fieldErrors?.email ? true : undefined}
                />
              </Field>

              <Field label="Role" error={state.fieldErrors?.role}>
                <select
                  name="role"
                  defaultValue="member"
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                >
                  {INVITABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                >
                  Cancel
                </button>
                <span className="sm:w-40">
                  <SubmitButton pendingLabel="Creating…">
                    Create invitation
                  </SubmitButton>
                </span>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
