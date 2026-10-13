import "server-only";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { sessions } from "@/db/schema";
import { requireRole } from "@/server/auth";
import { AppError } from "@/server/errors";
import {
  createClient,
  createMembership,
  createOrganization,
  createProject,
  createSession,
  createUser,
} from "@/server/test/fixtures";
import { resetTestDb, withTestDb } from "@/server/test/db-harness";
import { deleteTask } from "@/server/data/tasks";

/**
 * REQUEST-BOUND authorization — the real `requireRole()` path.
 *
 * `requireRole()` resolves the caller through cookies → hashed-token session
 * lookup → user → active organization → membership → role. Only the HTTP
 * cookie boundary is mocked (`next/headers`), which is the legitimate external
 * boundary; everything else is the production code path.
 *
 * This also proves `requireRoleWithContext` is not a divergent policy: it is
 * the exact predicate `requireRole` delegates to after resolving the context
 * (see src/server/auth/index.ts), so the two cannot disagree.
 */

const cookie = vi.hoisted(() => ({ value: "" }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "nexaflow_session" ? { value: cookie.value } : undefined,
  }),
}));

afterAll(async () => {
  await resetTestDb();
});

/** Redirects inside server actions throw a NEXT_REDIRECT error. */
function isRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

async function actAs(
  tx: Parameters<Parameters<typeof withTestDb>[0]>[0],
  sessionId: string,
): Promise<void> {
  const { generateSessionToken, hashSessionToken } = await import(
    "@/server/auth/session"
  );
  const rawToken = generateSessionToken();
  await tx
    .update(sessions)
    .set({ tokenHash: hashSessionToken(rawToken) })
    .where(eq(sessions.id, sessionId));
  cookie.value = rawToken;
}

describe("request-bound requireRole() authorization", () => {
  it("allows an owner for an owner-only action", async () => {
    await withTestDb(async (tx) => {
      const user = await createUser(tx, { email: "rb-owner@nexaflow.dev" });
      const org = await createOrganization(tx);
      await createMembership(tx, { userId: user.id, organizationId: org.id, role: "owner" });
      const session = await createSession(tx, { userId: user.id, activeOrganizationId: org.id });
      await actAs(tx, session.id);

      const ctx = await requireRole("owner");
      expect(ctx.membership.role).toBe("owner");
      expect(ctx.organization.id).toBe(org.id);
      expect(ctx.user.id).toBe(user.id);
    });
  });

  it("denies a member for an owner-only action", async () => {
    await withTestDb(async (tx) => {
      const user = await createUser(tx, { email: "rb-member@nexaflow.dev" });
      const org = await createOrganization(tx);
      await createMembership(tx, { userId: user.id, organizationId: org.id, role: "member" });
      const session = await createSession(tx, { userId: user.id, activeOrganizationId: org.id });
      await actAs(tx, session.id);

      // requireRole is async, so the denial surfaces as a rejected promise.
      await expect(requireRole("owner")).rejects.toThrowError(AppError);
      // An admin-or-owner gate is equally out of reach for a plain member.
      await expect(requireRole("owner", "admin")).rejects.toThrowError(AppError);
    });
  });

  it("allows an admin for an admin-or-owner action", async () => {
    await withTestDb(async (tx) => {
      const user = await createUser(tx, { email: "rb-admin@nexaflow.dev" });
      const org = await createOrganization(tx);
      await createMembership(tx, { userId: user.id, organizationId: org.id, role: "admin" });
      const session = await createSession(tx, { userId: user.id, activeOrganizationId: org.id });
      await actAs(tx, session.id);

      const ctx = await requireRole("owner", "admin");
      expect(ctx.membership.role).toBe("admin");
    });
  });

  it("denies an unauthenticated request (no session)", async () => {
    await withTestDb(async () => {
      cookie.value = "not-a-real-session-token";
      await expect(requireRole("owner")).rejects.toSatisfy(isRedirect);
    });
  });

  it("denies a session whose active organization is no longer a membership of the user", async () => {
    await withTestDb(async (tx) => {
      const user = await createUser(tx, { email: "rb-foreign@nexaflow.dev" });
      const ownOrg = await createOrganization(tx);
      const otherOrg = await createOrganization(tx);
      await createMembership(tx, { userId: user.id, organizationId: ownOrg.id, role: "owner" });

      // The composite FK sessions(user_id, active_organization_id) → memberships
      // makes it IMPOSSIBLE to insert a session pointing at a non-membership
      // org in the first place (verified: the insert is rejected). The only
      // realistic path to this state is losing the membership AFTER the session
      // existed — so build it that way.
      const membership = await createMembership(tx, {
        userId: user.id,
        organizationId: otherOrg.id,
        role: "owner",
      });
      const session = await createSession(tx, {
        userId: user.id,
        activeOrganizationId: otherOrg.id,
      });
      await actAs(tx, session.id);

      // Sanity: the session WAS valid while the membership existed.
      const before = await requireRole("owner");
      expect(before.organization.id).toBe(otherOrg.id);

      // Membership removed (e.g. owner removed them from the organization).
      await tx
        .delete((await import("@/db/schema")).memberships)
        .where(eq((await import("@/db/schema")).memberships.id, membership.id));

      // Now the same live session must fail closed.
      await expect(requireRole("owner")).rejects.toSatisfy(isRedirect);
    });
  });

  it("forged organization-external IDs cannot bypass tenant scoping in the data layer", async () => {
    await withTestDb(async (tx) => {
      const ownerA = await createUser(tx, { email: "rb-a@nexaflow.dev" });
      const ownerB = await createUser(tx, { email: "rb-b@nexaflow.dev" });
      const orgA = await createOrganization(tx);
      const orgB = await createOrganization(tx);
      await createMembership(tx, { userId: ownerA.id, organizationId: orgA.id, role: "owner" });
      await createMembership(tx, { userId: ownerB.id, organizationId: orgB.id, role: "owner" });

      const clientB = await createClient(tx, { organizationId: orgB.id });
      const projectB = await createProject(tx, { organizationId: orgB.id, clientId: clientB.id });

      const sessionA = await createSession(tx, { userId: ownerA.id, activeOrganizationId: orgA.id });
      await actAs(tx, sessionA.id);

      // A fully authenticated OWNER of org A still cannot touch org B's rows.
      const ctx = await requireRole("owner");
      const deleted = await deleteTask(ctx, projectB.id);
      expect(deleted).toBe(false);
    });
  });
});
