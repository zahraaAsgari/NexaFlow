import "server-only";

import { and, count, desc, eq, lt, ne } from "drizzle-orm";

import { db } from "@/db";
import { clients, memberships, projects, tasks } from "@/db/schema";
import type { AuthContext } from "@/server/auth";
import { ownedByOrg } from "./tenant";

/**
 * Dashboard overview data.
 *
 * Every function is tenant-safe: organization_id comes from requireContext()
 * in the caller and is constrained in SQL via ownedByOrg — never from client
 * input or a URL. All values derive from the real transactional tables;
 * nothing is trend-based, percentage-based, or inferred.
 *
 * Status-grouped counts use GROUP BY (one round trip per entity) instead of
 * separate per-status count queries. Overdue uses a single constrained count.
 */

export type ProjectStatusCounts = {
  total: number;
  active: number;
  completed: number;
  archived: number;
};

export type TaskStatusCounts = {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  /** Tasks with a due_date strictly before today that are not yet done.
   *  Computed from the real tasks.due_date column vs. the server's date. */
  overdue: number;
};

function nz(value: number | undefined): number {
  return value ?? 0;
}

/** Total clients in the active organization. */
export async function countClients(ctx: AuthContext): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(clients)
    .where(ownedByOrg(ctx, clients.organizationId));
  return nz(rows[0]?.value);
}

/** Total members (memberships) in the active organization. */
export async function countMembers(ctx: AuthContext): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(memberships)
    .where(ownedByOrg(ctx, memberships.organizationId));
  return nz(rows[0]?.value);
}

/** Project counts grouped by project_status in one tenant-scoped query. */
export async function countProjectsByStatus(
  ctx: AuthContext,
): Promise<ProjectStatusCounts> {
  const rows = await db
    .select({ status: projects.status, value: count() })
    .from(projects)
    .where(ownedByOrg(ctx, projects.organizationId))
    .groupBy(projects.status);

  const result: ProjectStatusCounts = {
    total: 0,
    active: 0,
    completed: 0,
    archived: 0,
  };
  for (const row of rows) {
    const value = nz(row.value);
    if (row.status === "active") result.active = value;
    else if (row.status === "completed") result.completed = value;
    else if (row.status === "archived") result.archived = value;
    result.total += value;
  }
  return result;
}

/**
 * Task counts grouped by task_status, plus overdue
 * (due_date < today AND status <> 'done') — two tenant-scoped queries run
 * together. The due_date column is date-only, so we compare against the
 * server's current date string with no timezone math.
 */
export async function countTasksByStatus(
  ctx: AuthContext,
): Promise<TaskStatusCounts> {
  const today = new Date().toISOString().slice(0, 10);

  const [statusRows, overdueRows] = await Promise.all([
    db
      .select({ status: tasks.status, value: count() })
      .from(tasks)
      .where(ownedByOrg(ctx, tasks.organizationId))
      .groupBy(tasks.status),
    db
      .select({ value: count() })
      .from(tasks)
      .where(
        and(
          ownedByOrg(ctx, tasks.organizationId),
          lt(tasks.dueDate, today),
          ne(tasks.status, "done"),
        ),
      ),
  ]);

  const result: TaskStatusCounts = {
    total: 0,
    todo: 0,
    inProgress: 0,
    done: 0,
    overdue: nz(overdueRows[0]?.value),
  };
  for (const row of statusRows) {
    const value = nz(row.value);
    if (row.status === "todo") result.todo = value;
    else if (row.status === "in_progress") result.inProgress = value;
    else if (row.status === "done") result.done = value;
    result.total += value;
  }
  return result;
}

/** Recently updated projects (most recent first), tenant-scoped. */
export type RecentProject = {
  id: string;
  name: string;
  clientName: string;
  status: "active" | "completed" | "archived";
  updatedAt: Date;
};

export async function listRecentProjects(
  ctx: AuthContext,
  limit: number,
): Promise<RecentProject[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      clientName: clients.name,
      status: projects.status,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(
      clients,
      and(
        eq(clients.id, projects.clientId),
        eq(clients.organizationId, projects.organizationId),
      ),
    )
    .where(ownedByOrg(ctx, projects.organizationId))
    .orderBy(desc(projects.updatedAt))
    .limit(limit);

  return rows;
}

/** Recently created tasks (with project and assignee context), tenant-scoped. */
export type RecentTask = {
  id: string;
  title: string;
  projectName: string;
  status: "todo" | "in_progress" | "done";
  dueDate: string | null;
  createdAt: Date;
};

export async function listRecentTasks(
  ctx: AuthContext,
  limit: number,
): Promise<RecentTask[]> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      projectName: projects.name,
      status: tasks.status,
      dueDate: tasks.dueDate,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .innerJoin(
      projects,
      and(
        eq(projects.id, tasks.projectId),
        eq(projects.organizationId, tasks.organizationId),
      ),
    )
    .where(ownedByOrg(ctx, tasks.organizationId))
    .orderBy(desc(tasks.createdAt))
    .limit(limit);

  return rows;
}
