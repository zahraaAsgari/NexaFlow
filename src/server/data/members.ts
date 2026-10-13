import "server-only";

import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import type { AuthContext } from "@/server/auth";
import { ownedByOrg } from "./tenant";

/**
 * Organization member access. Used by the Tasks assignee selector.
 *
 * `tasks.assignee_id` references `memberships.user_id` (via the composite FK
 * with organization_id), so an assignee is identified by USER id — resolved
 * here only within the active organization. No password hash, no session
 * data, and no other organization's people are ever selected.
 */

export type OrganizationMember = {
  /** Membership id — the tenant-scoped row the Team module targets. */
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  joinedAt: Date;
};

/**
 * Every member of the active organization (oldest membership first), joined
 * with the user in a single tenant-scoped query — no N+1. Only safe display
 * fields are selected; password hashes and session data are never read.
 */
export async function listOrganizationMembers(
  ctx: AuthContext,
): Promise<OrganizationMember[]> {
  return db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      name: users.name,
      email: users.email,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(ownedByOrg(ctx, memberships.organizationId))
    .orderBy(asc(memberships.createdAt));
}

/**
 * True when the given user id is a member of the ACTIVE organization.
 * The tasks composite FK enforces the same rule at the database level; this
 * gives the application a safe, non-revealing domain error first.
 */
export async function isOrganizationMember(
  ctx: AuthContext,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        ownedByOrg(ctx, memberships.organizationId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/* ====================================================================== */
/*                       Team / Members management                         */
/* ====================================================================== */

export const MEMBERS_PAGE_SIZE = 25;

/** Case-insensitive member search within the tenant only (name + email). */
function memberSearchFilter(q: string | undefined): SQL | undefined {
  const term = q?.trim();
  if (!term) return undefined;
  const pattern = `%${term}%`;
  return or(ilike(users.name, pattern), ilike(users.email, pattern));
}

export type ListMembersOptions = {
  /** Optional case-insensitive search term applied inside the tenant only. */
  q?: string;
  limit: number;
  offset: number;
};

/** Tenant-scoped, server-side member search and pagination. */
export async function listMembers(
  ctx: AuthContext,
  options: ListMembersOptions,
): Promise<OrganizationMember[]> {
  return db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      name: users.name,
      email: users.email,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        ownedByOrg(ctx, memberships.organizationId),
        memberSearchFilter(options.q),
      ),
    )
    .orderBy(asc(memberships.createdAt))
    .limit(options.limit)
    .offset(options.offset);
}

/**
 * Number of members in the active organization, optionally matched by the
 * same tenant-scoped search filter as listMembers.
 */
export async function countMembers(
  ctx: AuthContext,
  q?: string,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        ownedByOrg(ctx, memberships.organizationId),
        memberSearchFilter(q),
      ),
    );
  return rows[0]?.value ?? 0;
}

/**
 * One membership by id, enforced tenant-scoped. Returns null when the
 * membership is not in this organization (indistinguishable from "missing").
 */
export async function getMemberById(
  ctx: AuthContext,
  membershipId: string,
): Promise<OrganizationMember | null> {
  const rows = await db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      name: users.name,
      email: users.email,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.id, membershipId),
        ownedByOrg(ctx, memberships.organizationId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Number of owners in the active organization (last-owner safety guard). */
export async function countOwners(
  ctx: AuthContext,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(memberships)
    .where(
      and(eq(memberships.role, "owner"), ownedByOrg(ctx, memberships.organizationId)),
    );
  return rows[0]?.value ?? 0;
}

/**
 * Changes a membership's role within the active organization. Returns null
 * when the membership is not in this tenant. Owner safety invariants are the
 * caller's responsibility (see the server actions).
 */
export async function updateMemberRole(
  ctx: AuthContext,
  membershipId: string,
  role: "owner" | "admin" | "member",
): Promise<OrganizationMember | null> {
  const rows = await db
    .update(memberships)
    .set({ role, updatedAt: new Date() })
    .where(
      and(
        eq(memberships.id, membershipId),
        ownedByOrg(ctx, memberships.organizationId),
      ),
    )
    .returning({ id: memberships.id });
  if (rows.length === 0) return null;
  return getMemberById(ctx, membershipId);
}

/**
 * Deletes a membership within the active organization. Database effects
 * (verified): the member's sessions for that org cascade away, and their
 * tasks' assignee_id is set to NULL (tasks survive). Returns true if removed.
 */
export async function removeMember(
  ctx: AuthContext,
  membershipId: string,
): Promise<boolean> {
  const rows = await db
    .delete(memberships)
    .where(
      and(
        eq(memberships.id, membershipId),
        ownedByOrg(ctx, memberships.organizationId),
      ),
    )
    .returning({ id: memberships.id });
  return rows.length > 0;
}
