import Link from "next/link";

import type { ProjectWithClient } from "@/server/data/projects";
import { DeleteProjectButton } from "./delete-project-button";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const statusStyles: Record<
  ProjectWithClient["status"],
  { label: string; dot: string; chip: string }
> = {
  active: {
    label: "Active",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
  completed: {
    label: "Completed",
    dot: "bg-indigo-500",
    chip: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  },
  archived: {
    label: "Archived",
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-500 ring-slate-500/20",
  },
};

/** Status shown with a dot AND a label — never colour alone. */
export function ProjectStatusBadge({
  status,
}: {
  status: ProjectWithClient["status"];
}) {
  const style = statusStyles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {style.label}
    </span>
  );
}

export function ProjectsList({
  projects,
  taskCounts,
  canManage,
}: {
  projects: ProjectWithClient[];
  /** projectId → task count, resolved in one grouped query by the caller. */
  taskCounts: Map<string, number>;
  canManage: boolean;
}) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-5 py-3">Project</th>
              <th scope="col" className="px-5 py-3">Client</th>
              <th scope="col" className="px-5 py-3">Status</th>
              <th scope="col" className="px-5 py-3">Created</th>
              <th scope="col" className="px-5 py-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((project) => (
              <tr key={project.id} className="transition hover:bg-slate-50/70">
                <td className="px-5 py-3.5">
                  <Link
                    href={`/projects/${project.id}`}
                    className="rounded-md font-medium text-slate-900 outline-none hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                  >
                    {project.name}
                  </Link>
                  {project.description ? (
                    <p className="mt-0.5 line-clamp-1 max-w-sm text-xs text-slate-500">
                      {project.description}
                    </p>
                  ) : null}
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {project.clientName}
                </td>
                <td className="px-5 py-3.5">
                  <ProjectStatusBadge status={project.status} />
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {formatDate(project.createdAt)}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {canManage ? (
                      <>
                        <Link
                          href={`/projects/${project.id}/edit`}
                          className="rounded-md px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                        >
                          Edit
                        </Link>
                        <DeleteProjectButton
                          projectId={project.id}
                          projectName={project.name}
                          taskCount={taskCounts.get(project.id) ?? 0}
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
        {projects.map((project) => (
          <li
            key={project.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/projects/${project.id}`}
                  className="rounded-md font-medium text-slate-900 outline-none hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                >
                  {project.name}
                </Link>
                <p className="truncate text-sm text-slate-500">
                  {project.clientName}
                </p>
              </div>
              <ProjectStatusBadge status={project.status} />
            </div>

            {project.description ? (
              <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                {project.description}
              </p>
            ) : null}

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
              <span>Created {formatDate(project.createdAt)}</span>
              {canManage ? (
                <span className="flex items-center gap-1.5">
                  <Link
                    href={`/projects/${project.id}/edit`}
                    className="rounded-md px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                  >
                    Edit
                  </Link>
                  <DeleteProjectButton
                    projectId={project.id}
                    projectName={project.name}
                    taskCount={taskCounts.get(project.id) ?? 0}
                  />
                </span>
              ) : (
                <span>View only</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
