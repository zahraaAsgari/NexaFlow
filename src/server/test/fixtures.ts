import "server-only";

import { randomBytes } from "node:crypto";

import type { Db } from "@/db";
import {
  clients,
  memberships,
  organizations,
  projects,
  sessions,
  tasks,
  users,
} from "@/db/schema";
import { hashPassword } from "@/server/auth/password";
import {
  generateSecurityToken,
  hashSecurityToken,
} from "@/server/security/tokens";

/**
 * Deterministic, obviously-fake fixture builders.
 *
 * They insert into whatever transaction `withTestDb` passed them, keeping
 * every row inside the same rollback transaction — so NOTHING ever persists,
 * suites are idempotent, and the persistent test database remains unchanged
 * between runs. Nothing here touches the development database: every route
 * to the DB passes through the SAME `db` singleton the harness has already
 * rebound onto the rollback transaction.
 */

export const FIX_PASSWORD = "correct-horse-battery-staple";

/**
 * Unique default slugs per call (organizations.slug is globally UNIQUE, so a
 * fixed default causes a 23505 when two suites run in the same test-database
 * worker pool at the same time). UUID uniqueness keeps suites concurrency-safe
 * while still TEST_DATABASE only — never production data.
 */
function uniqueSlug(): string {
  // Unique-per-call; UUID randomness is intentional here because slug
  // collisions are the ONLY thing that would otherwise invalidate fixtures on
  // concurrent test pools (no test flakiness, no guesswork).
  return `sec-test-${randomBytes(5).toString("hex")}`;
}

export type UserRow = typeof users.$inferSelect;

export async function createUser(
  tx: Db,
  overrides: Partial<
    Pick<UserRow, "email" | "name" | "passwordHash">
  > = {},
): Promise<UserRow> {
  const [row] = await tx
    .insert(users)
    .values({
      email: overrides.email ?? `sec-test-${randomBytes(5).toString("hex")}@nexaflow.dev`,
      name: overrides.name ?? "Security Test User",
      passwordHash:
        overrides.passwordHash ?? (await hashPassword(FIX_PASSWORD)),
    })
    .returning();
  return row;
}

export type OrgRow = typeof organizations.$inferSelect;

export async function createOrganization(
  tx: Db,
  overrides: Partial<Pick<OrgRow, "name" | "slug">> = {},
): Promise<OrgRow> {
  const [row] = await tx
    .insert(organizations)
    .values({
      name: overrides.name ?? "Security Test Org",
      slug: overrides.slug ?? uniqueSlug(),
    })
    .returning();
  return row;
}

export type MembershipRow = typeof memberships.$inferSelect;

export async function createMembership(
  tx: Db,
  input: {
    userId: string;
    organizationId: string;
    role: MembershipRow["role"];
  },
): Promise<MembershipRow> {
  const [row] = await tx.insert(memberships).values(input).returning();
  return row;
}

export type SessionRow = typeof sessions.$inferSelect;

export async function createSession(
  tx: Db,
  input: {
    userId: string;
    activeOrganizationId: string;
  },
): Promise<SessionRow> {
  const [row] = await tx
    .insert(sessions)
    .values({
      userId: input.userId,
      activeOrganizationId: input.activeOrganizationId,
      tokenHash: hashSecurityToken(generateSecurityToken()),
      expiresAt: new Date(Date.now() + 3600 * 1000),
    })
    .returning();
  return row;
}

export type ClientRow = typeof clients.$inferSelect;

export async function createClient(
  tx: Db,
  input: {
    organizationId: string;
    name?: string;
    email?: string | null;
    company?: string | null;
  },
): Promise<ClientRow> {
  const [row] = await tx
    .insert(clients)
    .values({
      organizationId: input.organizationId,
      name: input.name ?? "Security Test Client",
      email: input.email ?? null,
      company: input.company ?? null,
    })
    .returning();
  return row;
}

export type ProjectRow = typeof projects.$inferSelect;

export async function createProject(
  tx: Db,
  input: {
    organizationId: string;
    clientId: string;
    name?: string;
  },
): Promise<ProjectRow> {
  const [row] = await tx
    .insert(projects)
    .values({
      organizationId: input.organizationId,
      clientId: input.clientId,
      name: input.name ?? "Security Test Project",
    })
    .returning();
  return row;
}

export type TaskRow = typeof tasks.$inferSelect;

export async function createTask(
  tx: Db,
  input: {
    organizationId: string;
    projectId: string;
    title?: string;
    assigneeId?: string | null;
    status?: TaskRow["status"];
    priority?: TaskRow["priority"];
  },
): Promise<TaskRow> {
  const [row] = await tx
    .insert(tasks)
    .values({
      organizationId: input.organizationId,
      projectId: input.projectId,
      title: input.title ?? "Security Test Task",
      assigneeId: input.assigneeId ?? null,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
    })
    .returning();
  return row;
}
