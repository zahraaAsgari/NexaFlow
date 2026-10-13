import "server-only";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { emailVerificationTokens, users } from "@/db/schema";
import { verifyEmailAction } from "@/server/actions/account-security";
import { createEmailVerificationToken } from "@/server/data/email-verification";
import {
  createMembership,
  createOrganization,
  createSession,
  createUser,
} from "@/server/test/fixtures";
import { resetTestDb, withTestDb } from "@/server/test/db-harness";

/**
 * Scanner safety — proves that merely LOADING the verification page cannot
 * consume a one-time credential, while the real confirmation action can.
 *
 * The page-level operation is the actual production page component: it is
 * imported and awaited exactly as Next.js would render it for a crawler or
 * mail-client link-preview fetch. The token-consuming boundary is the real
 * `verifyEmailAction`, which is what the page's confirm button submits to.
 *
 * Only framework boundaries are mocked (the HTTP cookie via `next/headers`,
 * and `next/cache` revalidation), so our validation, transaction and
 * consumption logic all run for real against the test database.
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

afterAll(async () => {
  await resetTestDb();
});

describe("email-verification scanner safety", () => {
  it("loading the page does NOT consume the token; the confirmation action DOES", async () => {
    await withTestDb(async (tx) => {
      const user = await createUser(tx, { email: "scanner@nexaflow.dev" });
      const org = await createOrganization(tx);
      await createMembership(tx, { userId: user.id, organizationId: org.id, role: "owner" });
      const session = await createSession(tx, {
        userId: user.id,
        activeOrganizationId: org.id,
      });

      const { generateSessionToken, hashSessionToken } = await import(
        "@/server/auth/session"
      );
      const rawSessionToken = generateSessionToken();
      await tx
        .update((await import("@/db/schema")).sessions)
        .set({ tokenHash: hashSessionToken(rawSessionToken) })
        .where(eq((await import("@/db/schema")).sessions.id, session.id));
      cookie.value = rawSessionToken;

      const { rawToken } = await createEmailVerificationToken(user.id);

      // --- 1. THE PAGE/LOAD PATH (what a scanner triggers) ---
      const page = await import(
        "@/app/(auth)/verify-email/[token]/page"
      ).then((m) => m.default);

      // Await the real server component exactly as the router would.
      const rendered = await page({
        params: Promise.resolve({ token: rawToken }),
      });
      expect(rendered).toBeTruthy();

      // DATABASE TRUTH: the credential is untouched by the page load.
      let tokenRow = (
        await tx
          .select()
          .from(emailVerificationTokens)
          .where(eq(emailVerificationTokens.userId, user.id))
      )[0];
      expect(tokenRow?.usedAt).toBeNull();

      let userRow = (await tx.select().from(users).where(eq(users.id, user.id)))[0];
      expect(userRow?.emailVerifiedAt).toBeNull();

      // --- 2. THE CONFIRMATION ACTION (what a real user click triggers) ---
      // The action signals success by redirecting, which throws a
      // NEXT_REDIRECT error — capture it and assert that is what happened.
      const redirectDigest = await verifyEmailAction(
        { status: "idle" },
        formWithToken(rawToken),
      ).then(
        () => null,
        (error: unknown) =>
          typeof (error as { digest?: unknown }).digest === "string"
            ? ((error as { digest: string }).digest)
            : null,
      );

      expect(redirectDigest).not.toBeNull();
      expect(redirectDigest?.startsWith("NEXT_REDIRECT")).toBe(true);

      // DATABASE TRUTH: consumed exactly once, and the email is now verified.
      tokenRow = (
        await tx
          .select()
          .from(emailVerificationTokens)
          .where(eq(emailVerificationTokens.userId, user.id))
      )[0];
      expect(tokenRow?.usedAt).not.toBeNull();

      userRow = (await tx.select().from(users).where(eq(users.id, user.id)))[0];
      expect(userRow?.emailVerifiedAt).not.toBeNull();
    });
  });

  it("a scanner hitting an already-consumed token cannot verify again", async () => {
    await withTestDb(async (tx) => {
      const user = await createUser(tx, { email: "scanner-replay@nexaflow.dev" });
      const org = await createOrganization(tx);
      await createMembership(tx, { userId: user.id, organizationId: org.id, role: "owner" });
      const session = await createSession(tx, { userId: user.id, activeOrganizationId: org.id });

      const { generateSessionToken, hashSessionToken } = await import(
        "@/server/auth/session"
      );
      const rawSessionToken = generateSessionToken();
      const { sessions } = await import("@/db/schema");
      await tx
        .update(sessions)
        .set({ tokenHash: hashSessionToken(rawSessionToken) })
        .where(eq(sessions.id, session.id));
      cookie.value = rawSessionToken;

      const { rawToken } = await createEmailVerificationToken(user.id);
      await verifyEmailAction({ status: "idle" }, formWithToken(rawToken)).catch(
        () => undefined,
      );

      // Replay through the SAME action must fail safely.
      const replay = await verifyEmailAction(
        { status: "idle" },
        formWithToken(rawToken),
      );
      expect(replay.status).toBe("error");
      expect(replay.formError).toMatch(/no longer valid|already been used/);

      // Verified exactly once — no state corruption.
      const userRow = (await tx.select().from(users).where(eq(users.id, user.id)))[0];
      expect(userRow?.emailVerifiedAt).not.toBeNull();
    });
  });
});

function formWithToken(token: string): FormData {
  const fd = new FormData();
  fd.set("token", token);
  return fd;
}
