"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  updateMemberRoleAction,
  type MemberActionState,
} from "@/server/actions/members";
import { ORGANIZATION_ROLES } from "@/server/validation/members";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

/**
 * Inline role editor for the Team table. The membership id travels as data
 * only; the server re-verifies owner authority and tenant ownership before
 * changing anything. The owner row is never rendered (handled by the parent).
 */
export function TeamRoleControl({
  membershipId,
  memberName,
  currentRole,
}: {
  membershipId: string;
  memberName: string;
  currentRole: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (_prev: MemberActionState, formData: FormData) => {
      const result = await updateMemberRoleAction(_prev, formData);
      if (result.status === "idle") {
        toast.success("Role updated");
        router.refresh();
      }
      return result;
    },
    { status: "idle" } as MemberActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="membershipId" value={membershipId} />
      <label htmlFor={`role-${membershipId}`} className="sr-only">
        Role for {memberName}
      </label>
      <span className="relative inline-flex">
        <select
          id={`role-${membershipId}`}
          name="role"
          defaultValue={currentRole}
          disabled={isPending}
          aria-label={`Change role for ${memberName}`}
          aria-invalid={state.status === "error" ? true : undefined}
          onChange={() => formRef.current?.requestSubmit()}
          className="appearance-none rounded-md border border-slate-300 bg-white py-1.5 pe-8 ps-3 text-xs font-medium text-slate-700 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {ORGANIZATION_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role] ?? role}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 end-2.5 grid place-items-center text-slate-400"
        >
          ▾
        </span>
      </span>
      {state.status === "error" ? (
        <p role="alert" className="max-w-40 text-xs text-red-600">
          {state.formError ?? "Couldn't update role."}
        </p>
      ) : null}
    </form>
  );
}
