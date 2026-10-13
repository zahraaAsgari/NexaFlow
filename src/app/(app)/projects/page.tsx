import Link from "next/link";

import { requireContext } from "@/server/auth";
import {
  PROJECTS_PAGE_SIZE,
  countProjects,
  countTasksByProjects,
  listProjects,
} from "@/server/data/projects";
import { projectsSearchParamsSchema } from "@/server/validation/projects";
import { FeatureNotice } from "@/components/notifications/feature-notice";
import { ProjectSearch } from "@/components/projects/project-search";
import { ProjectsList } from "@/components/projects/projects-table";
import { EmptyState } from "@/components/app/empty-state";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requireContext();
  const canManage =
    ctx.membership.role === "owner" || ctx.membership.role === "admin";

  const raw = await searchParams;
  const parsed = projectsSearchParamsSchema.safeParse({
    q: typeof raw.q === "string" ? raw.q : "",
    page: typeof raw.page === "string" ? raw.page : undefined,
  });
  const q = parsed.success ? parsed.data.q : "";
  const requestedPage = parsed.success ? parsed.data.page : 1;

  const total = await countProjects(ctx, q || undefined);
  const totalPages = Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const rows = await listProjects(ctx, {
    q: q || undefined,
    limit: PROJECTS_PAGE_SIZE,
    offset: (page - 1) * PROJECTS_PAGE_SIZE,
  });

  // One grouped query for every row on this page — no N+1.
  const taskCounts = await countTasksByProjects(
    ctx,
    rows.map((row) => row.id),
  );

  const orgTotal = q ? await countProjects(ctx) : total;

  return (
    <div className="space-y-6">
      <FeatureNotice
        entity="projects"
        labels={{
          created: "Project created",
          updated: "Project updated",
          deleted: "Project deleted",
        }}
      />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Projects
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track the work your workspace delivers for each client.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ProjectSearch q={q} />
        {canManage ? (
          <Link
            href="/projects/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2"
          >
            <Icon name="plus" className="h-4 w-4" />
            New project
          </Link>
        ) : null}
      </div>

      {total === 0 && !q ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white">
          <EmptyState
            icon="projects"
            title="No projects yet."
            description={
              canManage
                ? "Create a project to start organizing work for a client."
                : "This workspace doesn't have any projects yet."
            }
          >
            {canManage ? (
              <Link
                href="/projects/new"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2"
              >
                <Icon name="plus" className="h-4 w-4" />
                Create your first project
              </Link>
            ) : null}
          </EmptyState>
        </div>
      ) : total === 0 && q ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white">
          <EmptyState
            icon="search"
            title="No projects match your search."
            description={`Nothing in ${ctx.organization.name} matches that search.`}
          >
            <Link
              href="/projects"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            >
              Clear search
            </Link>
          </EmptyState>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {q
              ? `${total} ${total === 1 ? "result" : "results"} for that search of ${orgTotal} projects`
              : `${total} ${total === 1 ? "project" : "projects"}`}
          </p>

          <ProjectsList
            projects={rows}
            taskCounts={taskCounts}
            canManage={canManage}
          />

          {totalPages > 1 ? (
            <nav
              aria-label="Projects pagination"
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
            >
              {page > 1 ? (
                <PaginationLink q={q} page={page - 1} label="Previous" />
              ) : (
                <span className="text-slate-300">Previous</span>
              )}
              <span className="text-slate-500">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <PaginationLink q={q} page={page + 1} label="Next" />
              ) : (
                <span className="text-slate-300">Next</span>
              )}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

function PaginationLink({
  q,
  page,
  label,
}: {
  q: string;
  page: number;
  label: string;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  return (
    <Link
      href={`/projects?${params.toString()}`}
      className="rounded-md px-2 py-1 font-medium text-indigo-600 outline-none hover:text-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
    >
      {label}
    </Link>
  );
}
