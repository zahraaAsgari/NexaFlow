"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Icon } from "@/components/icons";
import {
  removeMemberAction,
  type MemberActionState,
} from "@/server/actions/members";

function RemoveSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Removing…" : label}
    </button>
  );
}

/**
 * Accessible removal confirmation (native <dialog>). The copy reflects the
 * verified database behaviour: the member's sessions for this org are
 * revoked, and their assigned tasks become unassigned (tasks survive).
 */
export function RemoveMemberButton({
  membershipId,
  memberName,
  assignmentCount,
}: {
  membershipId: string;
  memberName: string;
  assignmentCount: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (_prev: MemberActionState, formData: FormData) => {
      const result = await removeMemberAction(_prev, formData);
      if (result.status === "idle") {
        dialogRef.current?.close();
        toast.success("Member removed");
        router.refresh();
      }
      return result;
    },
    { status: "idle" } as MemberActionState,
  );

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="rounded-md px-2 py-1 text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
      >
        Remove
      </button>

      <dialog
        ref={dialogRef}
        aria-label={`Remove ${memberName}`}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        className="fixed inset-0 m-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/45"
      >
        <div className="p-6">
          <div className="flex items-start gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
              <Icon name="close" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">
                Remove {memberName}?
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                <strong className="font-semibold">{memberName}</strong> will
                lose access to this organization. Their user account is not
                deleted.
                {assignmentCount > 0
                  ? ` ` +
                    `${assignmentCount} ${
                      assignmentCount === 1 ? "task" : "tasks"
                    } assigned to them will become unassigned.`
                  : ""}
              </p>
            </div>
          </div>

          {state.status === "error" ? (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              {state.formError ?? "Couldn't remove this member."}
            </p>
          ) : null}

          <form
            action={formAction}
            className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end"
          >
            <input type="hidden" name="membershipId" value={membershipId} />
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            >
              Cancel
            </button>
            <RemoveSubmit label="Remove member" />
          </form>
        </div>
      </dialog>
    </>
  );
}
