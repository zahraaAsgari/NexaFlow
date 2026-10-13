"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

import {
  revokeInvitationAction,
  type RevokeInvitationState,
} from "@/server/actions/invitations";

/**
 * Revokes a pending invitation. Deleting the row immediately invalidates the
 * corresponding link (the token hash disappears with it).
 */
export function RevokeInvitationButton({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (prev: RevokeInvitationState, formData: FormData) => {
      const result = await revokeInvitationAction(prev, formData);
      if (result.status === "idle") router.refresh();
      return result;
    },
    { status: "idle" } as RevokeInvitationState,
  );

  return (
    <form action={formAction} className="inline-flex flex-col items-end">
      <input type="hidden" name="invitationId" value={invitationId} />
      <button
        type="submit"
        disabled={isPending}
        aria-label={`Revoke invitation for ${email}`}
        className="rounded-md px-2 py-1 text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 disabled:opacity-60"
      >
        {isPending ? "Revoking…" : "Revoke"}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="text-xs text-red-600">
          {state.formError ?? "Couldn't revoke."}
        </p>
      ) : null}
    </form>
  );
}
