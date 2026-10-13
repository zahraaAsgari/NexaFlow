import { requireContext } from "@/server/auth";
import {
  countClients,
  countMembers,
  countProjectsByStatus,
  countTasksByStatus,
  listRecentProjects,
  listRecentTasks,
} from "@/server/data/dashboard";
import { QuickActions } from "@/components/app/quick-actions";
import { MetricCard } from "@/components/app/metric-card";
import { StatusOverview } from "@/components/app/status-overview";
import { RecentWork } from "@/components/app/recent-work";

export const dynamic = "force-dynamic";

const RECENT_LIMIT = 5;

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Tenant-aware overview. Every number and row is real data for the active
 * organization, loaded through the tenant-safe data layer in parallel.
 * No trends, percentages, or fabricated analytics.
 */
export default async function DashboardPage() {
  const ctx = await requireContext();

  const [
    clients,
    members,
    projectCounts,
    taskCounts,
    recentProjects,
    recentTasks,
  ] = await Promise.all([
    countClients(ctx),
    countMembers(ctx),
    countProjectsByStatus(ctx),
    countTasksByStatus(ctx),
    listRecentProjects(ctx, RECENT_LIMIT),
    listRecentTasks(ctx, RECENT_LIMIT),
  ]);

  return (
    <div className="space-y-9">
      {/* 1. Organization context */}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {greetingFor(new Date())}, {ctx.user.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Here is what is happening in {ctx.organization.name}.
        </p>
      </header>

      {/* 2. Quick actions (unchanged) */}
      <QuickActions />

      {/* 3. Primary metrics */}
      <section aria-labelledby="primary-metrics" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="primary-metrics"
            className="text-base font-semibold text-slate-900"
          >
            Overview
          </h2>
          <span className="text-xs text-slate-400">
            Live for {ctx.organization.name}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Clients"
            value={clients}
            icon="clients"
            href="/clients"
            description={
              clients === 0
                ? "Add your first client to get started."
                : "People and companies you work with."
            }
            hint={clients > 0 ? "View clients" : "Create client"}
          />
          <MetricCard
            label="Active projects"
            value={projectCounts.active}
            icon="projects"
            href="/projects"
            description={
              projectCounts.total === 0
                ? "No projects yet."
                : `${projectCounts.total} project${projectCounts.total === 1 ? "" : "s"} in total.`
            }
            hint={projectCounts.total > 0 ? "View projects" : "Create project"}
          />
          <MetricCard
            label="Open tasks"
            value={taskCounts.todo + taskCounts.inProgress}
            icon="tasks"
            href="/tasks"
            description={
              taskCounts.total === 0
                ? "No tasks yet."
                : taskCounts.overdue > 0
                  ? `${taskCounts.overdue} overdue.`
                  : "Tracked across your projects."
            }
            hint={taskCounts.total > 0 ? "View tasks" : "Create task"}
          />
          <MetricCard
            label="Team members"
            value={members}
            icon="users"
            href="/team"
            description={
              members === 1
                ? "You are the only member."
                : "People in this organization."
            }
            hint="View team"
          />
        </div>
      </section>

      {/* 4. Status overview */}
      <div className="grid gap-4 lg:grid-cols-2">
        <StatusOverview
          title="Projects by status"
          icon="projects"
          total={projectCounts.total}
          emptyTitle="No projects yet."
          emptyDescription="Create a project to start tracking status."
          items={[
            { label: "Active", value: projectCounts.active, total: projectCounts.total, dot: "bg-emerald-500" },
            { label: "Completed", value: projectCounts.completed, total: projectCounts.total, dot: "bg-indigo-500" },
            { label: "Archived", value: projectCounts.archived, total: projectCounts.total, dot: "bg-slate-400" },
          ]}
        />
        <StatusOverview
          title="Tasks by status"
          icon="tasks"
          total={taskCounts.total}
          emptyTitle="No tasks yet."
          emptyDescription="Create a task to start tracking status."
          items={[
            { label: "To do", value: taskCounts.todo, total: taskCounts.total, dot: "bg-slate-400" },
            { label: "In progress", value: taskCounts.inProgress, total: taskCounts.total, dot: "bg-amber-500" },
            { label: "Done", value: taskCounts.done, total: taskCounts.total, dot: "bg-emerald-500" },
            { label: "Overdue", value: taskCounts.overdue, total: taskCounts.total, dot: "bg-red-500" },
          ]}
        />
      </div>

      {/* 5. Recent work */}
      <RecentWork projects={recentProjects} tasks={recentTasks} />
    </div>
  );
}
