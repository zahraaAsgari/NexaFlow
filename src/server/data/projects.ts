import "server-only";

import { and, asc, count, eq, ilike, inArray, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { clients, projects, tasks } from "@/db/schema";
import type { AuthContext } from "@/server/auth";
import { AppError } from "@/server/errors";
import { getClientById } from "./clients";
import { ownedByOrg } from "./tenant";

/**
 * Project data access. A project's client MUST belong to the same active
 * organization; this is enforced two ways:
 *   1. application layer — the client is resolved via getClientById(ctx, id),
 *      so a client id from another organization fails here, and
 *   2. database layer — the composite FK (client_id, organization_id) →
 *      clients(id, organization_id) rejects any cross-tenant reference even
 *      if the application check were ever bypassed.
 *
 * Every query is scoped with ownedByOrg(ctx, projects.organizationId) at the
 * SQL level; nothing is filtered in application code after the fact.
 */

export type Project = typeof projects.$inferSelect;

/** A project joined with its (same-tenant) client for list/detail display. */
export type ProjectWithClient = Project & {
  clientName: string;
};

/** Server-side page size for the projects list. Bounded; not user-controlled. */
export const PROJECTS_PAGE_SIZE = 25;

/**
 * Case-insensitive match across project name/description and the joined
 * client name. Parameterized by Drizzle (no raw SQL); because the query
 * joins clients on BOTH id and organization_id, searching by client name can
 * never reach across tenants.
 */
function projectSearchFilter(q: string | undefined): SQL | undefined {
  const term = q?.trim();
  if (!term) return undefined;
  const pattern = `%${term}%`;
  return or(
    ilike(projects.name, pattern),
    ilike(projects.description, pattern),
    ilike(clients.name, pattern),
  );
}

/**
 * Join predicate tying a project to its client *within the same tenant*.
 * Mirrors the composite foreign key, so the join itself is tenant-safe.
 */
const clientJoinOn = and(
  eq(clients.id, projects.clientId),
  eq(clients.organizationId, projects.organizationId),
);

export async function getProjectById(
  ctx: AuthContext,
  projectId: string,
): Promise<ProjectWithClient | null> {
  const rows = await db
    .select({ project: projects, clientName: clients.name })
    .from(projects)
    .innerJoin(clients, clientJoinOn)
    .where(
      and(eq(projects.id, projectId), ownedByOrg(ctx, projects.organizationId)),
    )
    .limit(1);

  const row = rows[0];
  return row ? { ...row.project, clientName: row.clientName } : null;
}

export type ListProjectsOptions = {
  /** Optional case-insensitive search term applied inside the tenant only. */
  q?: string;
  limit: number;
  offset: number;
};

/**
 * Tenant-scoped, server-side search and pagination. The client name is
 * fetched via a single join (no N+1 per row).
 */
export async function listProjects(
  ctx: AuthContext,
  options: ListProjectsOptions,
): Promise<ProjectWithClient[]> {
  const rows = await db
    .select({ project: projects, clientName: clients.name })
    .from(projects)
    .innerJoin(clients, clientJoinOn)
    .where(
      and(
        ownedByOrg(ctx, projects.organizationId),
        projectSearchFilter(options.q),
      ),
    )
    .orderBy(asc(projects.name))
    .limit(options.limit)
    .offset(options.offset);

  return rows.map((row) => ({ ...row.project, clientName: row.clientName }));
}

export type ProjectInput = {
  clientId: string;
  name: string;
  description: string | null;
};

export async function createProject(
  ctx: AuthContext,
  input: ProjectInput,
): Promise<Project> {
  // Application-layer tenant check: the client must resolve within the
  // caller's active organization (a foreign client id yields null).
  const client = await getClientById(ctx, input.clientId);
  if (!client) {
    throw new AppError("validation", "Client not found.");
  }

  const [row] = await db
    .insert(projects)
    .values({
      clientId: input.clientId,
      name: input.name,
      description: input.description,
      // Tenant from context — the composite FK enforces it matches the client's org.
      organizationId: ctx.organization.id,
    })
    .returning();
  return row;
}

export type UpdateProjectInput = ProjectInput & {
  status: "active" | "completed" | "archived";
};

/**
 * Updates a project only if it belongs to the active org. Returns null when
 * the project is not in this tenant (indistinguishable from "missing").
 * The target client is re-verified against the same tenant on every update.
 */
export async function updateProject(
  ctx: AuthContext,
  projectId: string,
  input: UpdateProjectInput,
): Promise<Project | null> {
  const client = await getClientById(ctx, input.clientId);
  if (!client) {
    throw new AppError("validation", "Client not found.");
  }

  const rows = await db
    .update(projects)
    .set({
      clientId: input.clientId,
      name: input.name,
      description: input.description,
      status: input.status,
      updatedAt: new Date(),
    })
    .where(
      and(eq(projects.id, projectId), ownedByOrg(ctx, projects.organizationId)),
    )
    .returning();
  return rows[0] ?? null;
}

/** Deletes a project only if it belongs to the active org. true if removed. */
export async function deleteProject(
  ctx: AuthContext,
  projectId: string,
): Promise<boolean> {
  const rows = await db
    .delete(projects)
    .where(
      and(eq(projects.id, projectId), ownedByOrg(ctx, projects.organizationId)),
    )
    .returning({ id: projects.id });
  return rows.length > 0;
}

/**
 * Number of projects in the active organization, optionally matched by the
 * same tenant-scoped search filter as listProjects.
 */
export async function countProjects(
  ctx: AuthContext,
  q?: string,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(projects)
    .innerJoin(clients, clientJoinOn)
    .where(and(ownedByOrg(ctx, projects.organizationId), projectSearchFilter(q)));
  return rows[0]?.value ?? 0;
}

/**
 * Number of projects belonging to ONE client inside the active organization.
 * Used to surface the cascade on client deletion honestly.
 */
export async function countProjectsByClient(
  ctx: AuthContext,
  clientId: string,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(projects)
    .where(
      and(
        eq(projects.clientId, clientId),
        ownedByOrg(ctx, projects.organizationId),
      ),
    );
  return rows[0]?.value ?? 0;
}

/** Task count for ONE project in the active organization (delete warning). */
export async function countTasksByProject(
  ctx: AuthContext,
  projectId: string,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(tasks)
    .where(
      and(eq(tasks.projectId, projectId), ownedByOrg(ctx, tasks.organizationId)),
    );
  return rows[0]?.value ?? 0;
}

/**
 * Task counts for many projects in ONE grouped query — avoids an N+1 when
 * rendering the list. Returns a map of projectId → task count.
 */
export async function countTasksByProjects(
  ctx: AuthContext,
  projectIds: string[],
): Promise<Map<string, number>> {
  if (projectIds.length === 0) return new Map();

  const rows = await db
    .select({ projectId: tasks.projectId, value: count() })
    .from(tasks)
    .where(
      and(
        inArray(tasks.projectId, projectIds),
        ownedByOrg(ctx, tasks.organizationId),
      ),
    )
    .groupBy(tasks.projectId);

  return new Map(rows.map((row) => [row.projectId, row.value]));
}
