"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Icon } from "@/components/icons";
import {
  deleteProjectAction,
  type ProjectFormState,
} from "@/server/actions/projects";

function DeleteSubmit({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * Accessible delete confirmation built on the native <dialog> element:
 * showModal() provides focus trapping and Escape-to-close. Deletion is a
 * server action; the project id travels as data only — the server re-verifies
 * tenant ownership and role before anything is removed.
 *
 * The task warning reflects the verified database behaviour: tasks reference
 * (project_id, organization_id) with ON DELETE CASCADE.
 */
export function DeleteProjectButton({
  projectId,
  projectName,
  taskCount,
  variant = "text",
}: {
  projectId: string;
  projectName: string;
  taskCount: number;
  /** "text" for table rows, "button" for the detail page. */
  variant?: "text" | "button";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState(deleteProjectAction, {
    status: "idle",
  } as ProjectFormState);

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      {variant === "text" ? (
        <button
          type="button"
          onClick={open}
          aria-haspopup="dialog"
          className="rounded-md px-2 py-1 text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
        >
          Delete
        </button>
      ) : (
        <button
          type="button"
          onClick={open}
          aria-haspopup="dialog"
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
        >
          <Icon name="close" className="h-4 w-4" />
          Delete project
        </button>
      )}

      <dialog
        ref={dialogRef}
        aria-label={`Delete ${projectName}`}
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
                Delete {projectName}?
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                This permanently deletes{" "}
                <strong className="font-semibold">{projectName}</strong>
                {taskCount > 0
                  ? ` and its ${taskCount} ${taskCount === 1 ? "task" : "tasks"}`
                  : ""}
                . This action cannot be undone.
              </p>
            </div>
          </div>

          {state.status === "error" ? (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              {state.formError ?? "Couldn't delete this project."}
            </p>
          ) : null}

          <form
            action={formAction}
            className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end"
          >
            <input type="hidden" name="projectId" value={projectId} />
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            >
              Cancel
            </button>
            <DeleteSubmit label="Delete project" pendingLabel="Deleting…" />
          </form>
        </div>
      </dialog>
    </>
  );
}
