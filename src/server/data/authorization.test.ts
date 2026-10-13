import "server-only";

import { describe, expect, it } from "vitest";

import {
  countTasksByProjects,
  createProject,
  getProjectById,
  listProjects,
  updateProject,
  type Project as ProjectSchema,
} from "@/server/data/projects";
import {
  createTask,
  deleteTask,
  getTaskById,
  listTasks,
  updateTask,
  type Task as TaskSchema,
} from "@/server/data/tasks";
import {
  requireRoleWithContext,
  type AuthContext,
} from "@/server/auth";
import { AppError } from "@/server/errors";
import {
  createClient,
  createMembership,
  createOrganization,
  createProject as createProjectFixture,
  createSession,
  createTask as createTaskFixture,
  createUser,
} from "@/server/test/fixtures";
import { resetTestDb, withTestDb } from "@/server/test/db-harness";
import { eq } from "drizzle-orm";
import { db as sharedDb } from "@/db";
import { afterAll } from "vitest";

afterAll(async () => {
  // Leave the dedicated test database empty once this file finishes.
  await resetTestDb();
});

/**
 * CORE SECURITY SUITE — multi-tenant authorization, tenant isolation, and
 * role gating. Every assertion executes through the REAL production
 * functions (no mocks) inside ONE rollback transaction per test.
 *
 * `withTestDb` binds the shared `db` singleton onto the rollback transaction
 * for exactly the lifetime of the callback; everything is rolled back after,
 * so this suite reruns cleanly.
 */

type Membership = AuthContext["membership"];
type Session = AuthContext["session"];
type User = AuthContext["user"];
type Org = AuthContext["organization"];

function buildCtx(input: {
  user: User;
  organization: Org;
  membership: Membership;
  session: Session;
}): AuthContext {
  return input;
}

function assertStronglyAuthoritative(ctx: AuthContext): AuthContext {
  // The exact same role predicate the request-bound requireRole() delegates
  // to — pre-supplied with the AuthContext being audited.
  return requireRoleWithContext(ctx, "owner");
}

describe("multi-tenant authorization — real security isolation", () => {
  it("A: same-organization member can read their organization's project", async () => {
    await withTestDb(async (tx) => {
      const user = await createUser(tx);
      const organization = await createOrganization(tx);
      const membership = await createMembership(tx, {
        userId: user.id,
        organizationId: organization.id,
        role: "owner",
      });

      const client = await createClient(tx, { organizationId: organization.id });
      const project = await createProjectFixture(tx, {
        organizationId: organization.id,
        clientId: client.id,
      });

      const ctx = buildCtx({
        user: { id: user.id, email: user.email, name: user.name },
        organization: { id: organization.id, name: organization.name, slug: organization.slug },
        membership: { id: membership.id, role: membership.role },
        session: {
          id: (
            await createSession(tx, {
              userId: user.id,
              activeOrganizationId: organization.id,
            })
          ).id,
          expiresAt: new Date(),
        },
      });

      const fetched = await getProjectById(ctx, project.id);
      expect(fetched?.id).toBe(project.id);
    });
  });

  it("B: NO cross-organization access — User A cannot read Organization B's project", async () => {
    await withTestDb(async (tx) => {
      const userA = await createUser(tx, { email: "u-a@security.dev" });
      const userB = await createUser(tx, { email: "u-b@security.dev" });
      const orgA = await createOrganization(tx, { name: "Org A", slug: "org-a-sec" });
      const orgB = await createOrganization(tx, { name: "Org B", slug: "org-b-sec" });
      const memA = await createMembership(tx, {
        userId: userA.id,
        organizationId: orgA.id,
        role: "owner",
      });
      // userB lives only in orgB.
      const client = await createClient(tx, { organizationId: orgB.id });
      const projectB = await createProjectFixture(tx, {
        organizationId: orgB.id,
        clientId: client.id,
      });

      const sessionA = await createSession(tx, {
        userId: userA.id,
        activeOrganizationId: orgA.id,
      });
      const ctxA =
        buildCtx({
          user: { id: userA.id, email: userA.email, name: userA.name },
          organization: { id: orgA.id, name: orgA.name, slug: orgA.slug },
          membership: { id: memA.id, role: memA.role },
          session: { id: sessionA.id, expiresAt: new Date() },
        });

      // Even *finding* Organization B's project using ITS OWN ID returns null —
      // there is no way to surface it by guessing a shape.
      const fetched = await getProjectById(ctxA, projectB.id);
      expect(fetched).toBeNull();

      // List returns ONLY the caller's org projects.
      const listing = await listProjects(ctxA, { limit: 25, offset: 0 });
      expect(listing.some((p) => p.id === projectB.id)).toBe(false);
    });
  });

  it("C: role gating — a member (not owner/admin) cannot perform owner work", async () => {
    await withTestDb(async (tx) => {
      const userA = await createUser(tx, { email: "u-a@security.dev" });
      const orgA = await createOrganization(tx, { name: "Org A", slug: "org-a-sec" });
      const memA = await createMembership(tx, {
        userId: userA.id,
        organizationId: orgA.id,
        role: "member",
      });
      const sessionA = await createSession(tx, {
        userId: userA.id,
        activeOrganizationId: orgA.id,
      });
      const ctxA =
        buildCtx({
          user: { id: userA.id, email: userA.email, name: userA.name },
          organization: { id: orgA.id, name: orgA.name, slug: orgA.slug },
          membership: { id: memA.id, role: memA.role },
          session: { id: sessionA.id, expiresAt: new Date() },
        });

      // Read paths remain available to members.
      const clientA = await createClient(tx, { organizationId: orgA.id });
      const projectA = await createProjectFixture(tx, {
        organizationId: orgA.id,
        clientId: clientA.id,
      });

      const fetched = await getProjectById(ctxA, projectA.id);
      expect(fetched?.id).toBe(projectA.id);

      // Same-author-guarded access path demand immediate rejection for the
      // *member* role (never silently denies-and-continues): the SAME
      // predicate used on production boundaries.
      expect(() => assertStronglyAuthoritative(ctxA)).toThrowError(AppError);
    });
  });

  it("D: owner can perform owner-guarded work", async () => {
    await withTestDb(async (tx) => {
      const userA = await createUser(tx, { email: "u-a@security.dev" });
      const orgA = await createOrganization(tx, { name: "Org A", slug: "org-a-sec" });
      const memA = await createMembership(tx, {
        userId: userA.id,
        organizationId: orgA.id,
        role: "owner",
      });
      const sessionA = await createSession(tx, {
        userId: userA.id,
        activeOrganizationId: orgA.id,
      });
      const ctxA =
        buildCtx({
          user: { id: userA.id, email: userA.email, name: userA.name },
          organization: { id: orgA.id, name: orgA.name, slug: orgA.slug },
          membership: { id: memA.id, role: memA.role },
          session: { id: sessionA.id, expiresAt: new Date() },
        });

      // The owner path is authorized (no throw).
      await assertStronglyAuthoritative(ctxA);
    });
  });

  it("E: forged tenant identifiers NEVER grant access — project from another org can't be mutated across orgs", async () => {
    await withTestDb(async (tx) => {
      const userA = await createUser(tx, { email: "u-a@security.dev" });
      const userB = await createUser(tx, { email: "u-b@security.dev" });
      const orgA = await createOrganization(tx, { name: "Org A", slug: "org-a-sec" });
      const orgB = await createOrganization(tx, { name: "Org B", slug: "org-b-sec" });
      const memA = await createMembership(tx, {
        userId: userA.id,
        organizationId: orgA.id,
        role: "owner",
      });
      const sessionA = await createSession(tx, {
        userId: userA.id,
        activeOrganizationId: orgA.id,
      });
      const ctxA = buildCtx({
        user: { id: userA.id, email: userA.email, name: userA.name },
        organization: { id: orgA.id, name: orgA.name, slug: orgA.slug },
        membership: { id: memA.id, role: memA.role },
        session: { id: sessionA.id, expiresAt: new Date() },
      });

      const clientB = await createClient(tx, { organizationId: orgB.id });
      const projectB = await createProjectFixture(tx, {
        organizationId: orgB.id,
        clientId: clientB.id,
        name: "B project",
      });

      // Attempt 1: deliberately forge an *unknown-to-A* client id on the
      // update targeting B's project. updateProject first resolves the client
      // in-tenant; an unknown client rejects with a neutral AppError BEFORE
      // any project mutation can happen. Row integrity proven lower.
      await expect(
        updateProject(ctxA, projectB.id, {
          clientId: clientB.id, // unknown to org A, so: reject-to-safety
          name: "HACKED",
          description: null,
          status: "archived",
        }),
      ).rejects.toThrowError(AppError);

      // Attempt 2: an in-tenant client must still not grant access — the
      // *project* predicate rejects NEVER leaking the row, whether by null or
      // a neutral AppError. Assert the row is UNCHANGED after (the actual
      // security shape both guards enforce).
      const clientA = await createClient(tx, { organizationId: orgA.id });
      try {
        await updateProject(ctxA, projectB.id, {
          clientId: clientA.id,
          name: "HACKED_STILL_NOT_OK",
          description: null,
          status: "archived",
        });
        // Some paths return null — that is fine; no mutation occurred.
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
      }
      const integrity = await sharedDb.query.projects.findFirst({
        where: (projects, { eq }) => eq(projects.id, projectB.id),
      });
      expect(integrity?.name).toBe("B project");

      // DELETE the equivalent forged resource id through the task data layer:
      // we're asserting the same tenant predicate the Projects data layer uses
      // — a cross-tenant id never reaches a row. *shows no rows affected at all.*
      const roleCreatedOnA = await createTaskFixture(tx, {
        organizationId: orgA.id,
        projectId: (
          await createProjectFixture(tx, {
            organizationId: orgA.id,
            clientId: (
              await createClient(tx, { organizationId: orgA.id })
            ).id,
          })
        ).id,
      });
      const acceptableTaskA = roleCreatedOnA;
      // Sanity: a forged MISMATCHED id (B's project id used as a task id) is a
      // 404-style no-op against A's context, too.
      const rejectedByA = await deleteTask(ctxA, projectB.id);
      expect(rejectedByA).toBe(false);
      // And A *can* delete A's task.
      const removed = await deleteTask(ctxA, acceptableTaskA.id);
      expect(removed).toBe(true);
    });
  });
});
