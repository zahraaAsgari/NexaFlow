import "server-only";

import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { memberships, projects, tasks, users } from "@/db/schema";
import type { AuthContext } from "@/server/auth";
import { AppError } from "@/server/errors";
import { getProjectById } from "./projects";
import { ownedByOrg } from "./tenant";

/**
 * Task data access. Both cross-entity references are tenant-guarded:
 *   - project → getProjectById(ctx, id)  (+ composite FK to projects)
 *   - assignee → membership must exist for the ACTIVE organization
 *     (+ composite FK (assignee_id, organization_id) → memberships)
 *
 * Every query is scoped with ownedByOrg(ctx, tasks.organizationId) at SQL
 * level; nothing is filtered in application code after the fact.
 *
 * Note on assignees: tasks.assignee_id holds a USERS id, matched through
 * memberships(user_id, organization_id) — so an assignee is always a member
 * of the owning organization, enforced by the database as well.
 */

export type Task = typeof tasks.$inferSelect;

/** A task joined with its (same-tenant) project and optional assignee. */
export type TaskWithRelations = Task & {
  projectName: string;
  assigneeName: string | null;
};

/** Server-side page size for task lists. Bounded; not user-controlled. */
export const TASKS_PAGE_SIZE = 25;

/**
 * Join predicate tying a task to its project *within the same tenant*.
 * Mirrors the composite foreign key, so the join itself is tenant-safe.
 */
const projectJoinOn = and(
  eq(projects.id, tasks.projectId),
  eq(projects.organizationId, tasks.organizationId),
);

/**
 * Assignee join, also tenant-bound: the membership row must belong to the
 * same organization as the task, so a foreign user can never be resolved.
 * Left-joined because assignee_id is nullable (unassigned tasks are valid).
 */
const membershipJoinOn = and(
  eq(memberships.userId, tasks.assigneeId),
  eq(memberships.organizationId, tasks.organizationId),
);

const selection = {
  task: tasks,
  projectName: projects.name,
  assigneeName: users.name,
};

function toTask(row: {
  task: Task;
  projectName: string;
  assigneeName: string | null;
}): TaskWithRelations {
  return {
    ...row.task,
    projectName: row.projectName,
    assigneeName: row.assigneeName,
  };
}

/**
 * Case-insensitive match across task title, project name and assignee name.
 * Parameterized by Drizzle (no raw SQL); because every join is tenant-bound,
 * searching by project or assignee name can never reach across tenants.
 * (Tasks have no description column, so none is searched.)
 */
function taskSearchFilter(q: string | undefined): SQL | undefined {
  const term = q?.trim();
  if (!term) return undefined;
  const pattern = `%${term}%`;
  return or(
    ilike(tasks.title, pattern),
    ilike(projects.name, pattern),
    ilike(users.name, pattern),
  );
}

export async function getTaskById(
  ctx: AuthContext,
  taskId: string,
): Promise<TaskWithRelations | null> {
  const rows = await db
    .select(selection)
    .from(tasks)
    .innerJoin(projects, projectJoinOn)
    .leftJoin(memberships, membershipJoinOn)
    .leftJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(tasks.id, taskId), ownedByOrg(ctx, tasks.organizationId)))
    .limit(1);

  const row = rows[0];
  return row ? toTask(row) : null;
}

export type ListTasksOptions = {
  /** Optional case-insensitive search term applied inside the tenant only. */
  q?: string;
  /** Optional project filter; still combined with the tenant predicate. */
  projectId?: string;
  limit: number;
  offset: number;
};

/**
 * Tenant-scoped, server-side search and pagination. Project and assignee
 * names come from joins in the same query — no N+1.
 */
export async function listTasks(
  ctx: AuthContext,
  options: ListTasksOptions,
): Promise<TaskWithRelations[]> {
  const rows = await db
    .select(selection)
    .from(tasks)
    .innerJoin(projects, projectJoinOn)
    .leftJoin(memberships, membershipJoinOn)
    .leftJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        ownedByOrg(ctx, tasks.organizationId),
        options.projectId ? eq(tasks.projectId, options.projectId) : undefined,
        taskSearchFilter(options.q),
      ),
    )
    .orderBy(asc(tasks.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  return rows.map(toTask);
}

/**
 * Tasks belonging to ONE project. Verifies the project itself resolves inside
 * the active organization first, so a foreign project id yields null rather
 * than an empty list that might imply the project exists.
 */
export async function listTasksByProject(
  ctx: AuthContext,
  projectId: string,
  options: { limit: number },
): Promise<TaskWithRelations[] | null> {
  const project = await getProjectById(ctx, projectId);
  if (!project) return null;

  return listTasks(ctx, {
    projectId,
    limit: options.limit,
    offset: 0,
  });
}

export type TaskInput = {
  projectId: string;
  title: string;
  assigneeId: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  /** Date-only string (YYYY-MM-DD) or null — matches the `date` column. */
  dueDate: string | null;
};

/**
 * Verifies the submitted project and assignee both belong to the active
 * organization. Throws a neutral AppError that never reveals whether the
 * referenced row exists in a different tenant.
 */
async function assertRelationsInTenant(
  ctx: AuthContext,
  input: Pick<TaskInput, "projectId" | "assigneeId">,
): Promise<void> {
  const project = await getProjectById(ctx, input.projectId);
  if (!project) {
    throw new AppError("validation", "Project not found.");
  }

  if (input.assigneeId) {
    const member = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, input.assigneeId),
          ownedByOrg(ctx, memberships.organizationId),
        ),
      )
      .limit(1);
    if (member.length === 0) {
      throw new AppError("validation", "Assignee not found.");
    }
  }
}

export async function createTask(
  ctx: AuthContext,
  input: TaskInput,
): Promise<Task> {
  await assertRelationsInTenant(ctx, input);

  const [row] = await db
    .insert(tasks)
    .values({
      projectId: input.projectId,
      title: input.title,
      assigneeId: input.assigneeId,
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate,
      // Tenant from context — the composite FKs enforce the references match.
      organizationId: ctx.organization.id,
    })
    .returning();
  return row;
}

/**
 * Updates a task only if it belongs to the active org. Returns null when the
 * task is not in this tenant (indistinguishable from "missing"). Project and
 * assignee are re-verified against the same tenant on every update.
 */
export async function updateTask(
  ctx: AuthContext,
  taskId: string,
  input: TaskInput,
): Promise<Task | null> {
  await assertRelationsInTenant(ctx, input);

  const rows = await db
    .update(tasks)
    .set({
      projectId: input.projectId,
      title: input.title,
      assigneeId: input.assigneeId,
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, taskId), ownedByOrg(ctx, tasks.organizationId)))
    .returning();
  return rows[0] ?? null;
}

/** Deletes a task only if it belongs to the active org. true if removed. */
export async function deleteTask(
  ctx: AuthContext,
  taskId: string,
): Promise<boolean> {
  const rows = await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), ownedByOrg(ctx, tasks.organizationId)))
    .returning({ id: tasks.id });
  return rows.length > 0;
}

/**
 * Number of tasks in the active organization, optionally matched by the same
 * tenant-scoped search/project filters as listTasks.
 */
export async function countTasks(
  ctx: AuthContext,
  options: { q?: string; projectId?: string } = {},
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(tasks)
    .innerJoin(projects, projectJoinOn)
    .leftJoin(memberships, membershipJoinOn)
    .leftJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        ownedByOrg(ctx, tasks.organizationId),
        options.projectId ? eq(tasks.projectId, options.projectId) : undefined,
        taskSearchFilter(options.q),
      ),
    );
  return rows[0]?.value ?? 0;
}

/*
 * Task counts per project (countTasksByProject / countTasksByProjects) live in
 * src/server/data/projects.ts, where the Projects module already defines them.
 * They are reused rather than duplicated here — and keeping them there avoids
 * a circular import, since this module imports getProjectById from projects.
 */

/**
 * Number of tasks assigned to ONE member (by users.id) within the active
 * organization. Used to explain the effect of removing that member — those
 * tasks become unassigned.
 */
export async function countTasksByAssignee(
  ctx: AuthContext,
  memberUserId: string,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(tasks)
    .where(
      and(
        eq(tasks.assigneeId, memberUserId),
        ownedByOrg(ctx, tasks.organizationId),
      ),
    );
  return rows[0]?.value ?? 0;
}
