import "server-only";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { sessions, users } from "@/db/schema";
import { changeAccountPasswordAction } from "@/server/actions/account";
import { verifyPassword } from "@/server/auth/password";
import {
  createMembership,
  createOrganization,
  createSession,
  createUser,
} from "@/server/test/fixtures";
import { resetTestDb, withTestDb } from "@/server/test/db-harness";

/**
 * Password-change session security, tested against the real `sessions` table.
 *
 * The production contract (src/server/actions/account.ts) is explicit:
 *   - the CURRENT session survives (`ne(sessions.id, auth.session.id)`)
 *   - every OTHER session belonging to the same user is deleted
 *   - unrelated users' sessions are untouched
 *
 * Only framework boundaries are mocked: `next/headers` supplies the session
 * cookie (the HTTP request is the external boundary) and `next/cache`
 * revalidation is a no-op outside a request. Our authorization, hashing and
 * session-invalidation logic all run for real.
 */

const cookie = vi.hoisted(() => ({ value: "" }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "nexaflow_session" ? { value: cookie.value } : undefined,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

const CURRENT_PASSWORD = "original-password-1";
const NEW_PASSWORD = "rotated-password-1";

afterAll(async () => {
  await resetTestDb();
});

describe("password-change session invalidation", () => {
  it("keeps the current session, deletes the user's other sessions, leaves other users untouched, and rotates the password", async () => {
    await withTestDb(async (tx) => {
      const userA = await createUser(tx, {
        email: "rotate-a@nexaflow.dev",
        passwordHash: await hash(CURRENT_PASSWORD),
      });
      const userB = await createUser(tx, {
        email: "rotate-b@nexaflow.dev",
        passwordHash: await hash("unrelated-password-1"),
      });
      const orgA = await createOrganization(tx);
      const orgB = await createOrganization(tx);
      await createMembership(tx, { userId: userA.id, organizationId: orgA.id, role: "owner" });
      await createMembership(tx, { userId: userB.id, organizationId: orgB.id, role: "owner" });

      const currentSession = await createSession(tx, {
        userId: userA.id,
        activeOrganizationId: orgA.id,
      });
      const otherSession = await createSession(tx, {
        userId: userA.id,
        activeOrganizationId: orgA.id,
      });
      const strangerSession = await createSession(tx, {
        userId: userB.id,
        activeOrganizationId: orgB.id,
      });

      // Act as the user holding `currentSession`.
      const { generateSessionToken, hashSessionToken } = await import(
        "@/server/auth/session"
      );
      const rawToken = generateSessionToken();
      await tx
        .update(sessions)
        .set({ tokenHash: hashSessionToken(rawToken) })
        .where(eq(sessions.id, currentSession.id));
      cookie.value = rawToken;

      const before = await tx.select().from(sessions);
      expect(before.length).toBe(3);

      const result = await changeAccountPasswordAction(
        { status: "idle" },
        passwordForm(CURRENT_PASSWORD, NEW_PASSWORD),
      );

      expect(result.status).toBe("saved");

      // DATABASE TRUTH — the sessions table, not a redirect.
      const after = await tx.select().from(sessions);
      const survivingIds = after.map((s) => s.id).sort();

      expect(survivingIds).toEqual(
        [currentSession.id, strangerSession.id].sort(),
      );
      expect(survivingIds).not.toContain(otherSession.id);
      expect(after.filter((s) => s.userId === userA.id).length).toBe(1);
      expect(after.filter((s) => s.userId === userB.id).length).toBe(1);

      // PASSWORD TRUTH — old fails, new verifies, hash actually changed.
      const rotated = (
        await tx.select().from(users).where(eq(users.id, userA.id))
      )[0];
      expect(rotated.passwordHash).not.toBe(userA.passwordHash);
      await expect(verifyPassword(CURRENT_PASSWORD, rotated.passwordHash)).resolves.toBe(false);
      await expect(verifyPassword(NEW_PASSWORD, rotated.passwordHash)).resolves.toBe(true);

      // User B's password is untouched.
      const untouched = (
        await tx.select().from(users).where(eq(users.id, userB.id))
      )[0];
      await expect(verifyPassword("unrelated-password-1", untouched.passwordHash)).resolves.toBe(true);
    });
  });

  it("rejects a change when the current password is wrong and invalidates nothing", async () => {
    await withTestDb(async (tx) => {
      const user = await createUser(tx, {
        email: "rotate-wrong@nexaflow.dev",
        passwordHash: await hash(CURRENT_PASSWORD),
      });
      const org = await createOrganization(tx);
      await createMembership(tx, { userId: user.id, organizationId: org.id, role: "owner" });
      const s1 = await createSession(tx, { userId: user.id, activeOrganizationId: org.id });
      const s2 = await createSession(tx, { userId: user.id, activeOrganizationId: org.id });

      const { generateSessionToken, hashSessionToken } = await import(
        "@/server/auth/session"
      );
      const rawToken = generateSessionToken();
      await tx
        .update(sessions)
        .set({ tokenHash: hashSessionToken(rawToken) })
        .where(eq(sessions.id, s1.id));
      cookie.value = rawToken;

      const result = await changeAccountPasswordAction(
        { status: "idle" },
        passwordForm("totally-wrong-password", NEW_PASSWORD),
      );

      expect(result.status).toBe("error");

      const after = await tx.select().from(sessions).where(eq(sessions.userId, user.id));
      expect(after.length).toBe(2);

      const unchanged = (
        await tx.select().from(users).where(eq(users.id, user.id))
      )[0];
      await expect(verifyPassword(CURRENT_PASSWORD, unchanged.passwordHash)).resolves.toBe(true);
    });
  });
});

async function hash(password: string): Promise<string> {
  const { hashPassword } = await import("@/server/auth/password");
  return hashPassword(password);
}

function passwordForm(current: string, next: string): FormData {
  const fd = new FormData();
  fd.set("currentPassword", current);
  fd.set("newPassword", next);
  fd.set("confirmPassword", next);
  return fd;
}
