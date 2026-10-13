"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, FormError, Input, SubmitButton } from "@/components/auth/form";
import type { TaskFormState } from "@/server/actions/tasks";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from "@/server/validation/tasks";

export type TaskFormDefaults = {
  projectId: string;
  title: string;
  assigneeId: string;
  status: (typeof TASK_STATUSES)[number];
  priority: (typeof TASK_PRIORITIES)[number];
  /** Date-only string (YYYY-MM-DD) or "" when unset. */
  dueDate: string;
};

export type ProjectOption = { id: string; name: string };
export type MemberOption = { userId: string; name: string };

type Props = {
  action: (prev: TaskFormState, formData: FormData) => Promise<TaskFormState>;
  defaults: TaskFormDefaults;
  /** Projects of the ACTIVE organization only — resolved server-side. */
  projects: ProjectOption[];
  /** Members of the ACTIVE organization only — resolved server-side. */
  members: MemberOption[];
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
};

const fieldClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Shared create/edit form. The project and assignee selectors list only the
 * organization's own records, but that is a UX restriction — the server
 * action independently re-verifies both ids against the authenticated tenant.
 */
export function TaskForm({
  action,
  defaults,
  projects,
  members,
  submitLabel,
  pendingLabel,
  cancelHref,
}: Props) {
  const [state, formAction] = useActionState(action, { status: "idle" });

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.formError} />

      <Field label="Title" error={state.fieldErrors?.title}>
        <Input
          id="task-title"
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={defaults.title}
          placeholder="e.g. Draft the homepage copy"
          aria-invalid={state.fieldErrors?.title ? true : undefined}
        />
      </Field>

      <Field label="Project" error={state.fieldErrors?.projectId}>
        <select
          id="task-project"
          name="projectId"
          required
          defaultValue={defaults.projectId}
          aria-invalid={state.fieldErrors?.projectId ? true : undefined}
          className={fieldClass}
        >
          <option value="">Select a project…</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Assignee" error={state.fieldErrors?.assigneeId}>
        <select
          id="task-assignee"
          name="assigneeId"
          defaultValue={defaults.assigneeId}
          aria-invalid={state.fieldErrors?.assigneeId ? true : undefined}
          aria-describedby="task-assignee-hint"
          className={fieldClass}
        >
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </select>
        <p id="task-assignee-hint" className="text-xs text-slate-500">
          Only people in this organization can be assigned.
        </p>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Status" error={state.fieldErrors?.status}>
          <select
            id="task-status"
            name="status"
            defaultValue={defaults.status}
            className={fieldClass}
          >
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Priority" error={state.fieldErrors?.priority}>
          <select
            id="task-priority"
            name="priority"
            defaultValue={defaults.priority}
            className={fieldClass}
          >
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {TASK_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Due date" error={state.fieldErrors?.dueDate}>
        <Input
          id="task-due-date"
          name="dueDate"
          type="date"
          defaultValue={defaults.dueDate}
          aria-invalid={state.fieldErrors?.dueDate ? true : undefined}
        />
      </Field>

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
