import Link from "next/link";

import type { TaskWithRelations } from "@/server/data/tasks";
import { DeleteTaskButton } from "./delete-task-button";
import { TaskPriorityBadge, TaskStatusBadge, formatDueDate } from "./task-badges";

/**
 * Reusable task list: a semantic table on desktop and cards on mobile.
 * The same component renders the /tasks page and the Tasks section of a
 * project, so the two can never drift apart. `showProject` hides the
 * redundant project column when already inside a project.
 */
export function TasksList({
  tasks,
  canManage,
  showProject = true,
}: {
  tasks: TaskWithRelations[];
  canManage: boolean;
  showProject?: boolean;
}) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-5 py-3">Task</th>
              {showProject ? (
                <th scope="col" className="px-5 py-3">Project</th>
              ) : null}
              <th scope="col" className="px-5 py-3">Assignee</th>
              <th scope="col" className="px-5 py-3">Status</th>
              <th scope="col" className="px-5 py-3">Priority</th>
              <th scope="col" className="px-5 py-3">Due</th>
              <th scope="col" className="px-5 py-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <tr key={task.id} className="transition hover:bg-slate-50/70">
                <td className="px-5 py-3.5">
                  <Link
                    href={`/tasks/${task.id}`}
                    className="rounded-md font-medium text-slate-900 outline-none hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                  >
                    {task.title}
                  </Link>
                </td>
                {showProject ? (
                  <td className="px-5 py-3.5 text-slate-600">
                    {task.projectName}
                  </td>
                ) : null}
                <td className="px-5 py-3.5 text-slate-600">
                  {task.assigneeName ?? (
                    <span className="text-slate-400">Unassigned</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <TaskStatusBadge status={task.status} />
                </td>
                <td className="px-5 py-3.5">
                  <TaskPriorityBadge priority={task.priority} />
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {task.dueDate ? (
                    formatDueDate(task.dueDate)
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {canManage ? (
                      <>
                        <Link
                          href={`/tasks/${task.id}/edit`}
                          className="rounded-md px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                        >
                          Edit
                        </Link>
                        <DeleteTaskButton
                          taskId={task.id}
                          taskTitle={task.title}
                        />
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">View only</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 lg:hidden">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/tasks/${task.id}`}
                  className="rounded-md font-medium text-slate-900 outline-none hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                >
                  {task.title}
                </Link>
                {showProject ? (
                  <p className="truncate text-sm text-slate-500">
                    {task.projectName}
                  </p>
                ) : null}
              </div>
              <TaskStatusBadge status={task.status} />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Assignee</dt>
                <dd className="truncate text-slate-700">
                  {task.assigneeName ?? "Unassigned"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Priority</dt>
                <dd>
                  <TaskPriorityBadge priority={task.priority} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Due</dt>
                <dd className="text-slate-700">
                  {task.dueDate ? formatDueDate(task.dueDate) : "—"}
                </dd>
              </div>
            </dl>

            {canManage ? (
              <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-slate-100 pt-3">
                <Link
                  href={`/tasks/${task.id}/edit`}
                  className="rounded-md px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                >
                  Edit
                </Link>
                <DeleteTaskButton taskId={task.id} taskTitle={task.title} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
