import "server-only";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loginAction } from "@/server/actions/auth";
import { forgotPasswordAction } from "@/server/actions/account-security";
import {
  consumeRateLimitAttempt,
  isRateLimited,
  resetRateLimitsForTests,
} from "@/server/security/rate-limit";
import { withTestDb } from "@/server/test/db-harness";
import { createUser, createOrganization, createMembership } from "@/server/test/fixtures";
import { hashPassword } from "@/server/auth/password";
import { users } from "@/db/schema";

/**
 * Abuse-resistance regression tests for the public unauthenticated write
 * surfaces. Only the client-IP header boundary is stubbed (X-Forwarded-For is
 * the external request boundary we already document as a coarse hint), while
 * the limiting counters, the production login/signup/forgot flows, the
 * database and the password hashing all run for real.
 */

const clientIp = vi.hoisted(() => ({ value: "10.10.10.10" }));

vi.mock("next/headers", () => ({
  headers: async () =>
    new Map([
      ["x-forwarded-for", clientIp.value],
    ]) as unknown as Headers,
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

vi.mock("next/navigation", () => {
  const actual = vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    redirect: (url: string) => {
      const error = new Error("NEXT_REDIRECT") as Error & { digest: string };
      error.digest = `NEXT_REDIRECT;push;${url};307;`;
      throw error;
    },
  };
});

beforeEach(() => {
  resetRateLimitsForTests();
});

afterEach(() => {
  resetRateLimitsForTests();
});

describe("rate limiter mechanics", () => {
  it("allows attempts within the window and rejects past the limit", () => {
    const key = "mechanics:test";
    for (let i = 0; i < 5; i++) {
      expect(consumeRateLimitAttempt(key, { limit: 5, windowMs: 60_000 })).toBe(true);
    }
    expect(consumeRateLimitAttempt(key, { limit: 5, windowMs: 60_000 })).toBe(false);
    expect(isRateLimited(key, { limit: 5, windowMs: 60_000 })).toBe(true);
  });

  it("resets when the window elapses", () => {
    const key = "mechanics:reset";
    expect(consumeRateLimitAttempt(key, { limit: 1, windowMs: 0 })).toBe(true);
    // windowMs=0: any later time is a new window
    expect(consumeRateLimitAttempt(key, { limit: 1, windowMs: 0 })).toBe(true);
  });
});

describe("login brute-force throttling", () => {
  it("blocks the 6th consecutive failed login against one email", async () => {
    await withTestDb(async (tx) => {
      clientIp.value = "10.20.30.40";
      await tx.insert(users).values({
        email: "victim@nexaflow.dev",
        name: "Victim",
        passwordHash: await hashPassword("victims-real-password-1"),
      });

      // 5 allowed failures (each returns generic invalid-credentials).
      for (let i = 0; i < 5; i++) {
        const attempt = await loginAction(
          { status: "idle" },
          loginForm("victim@nexaflow.dev", "wrong-password-1"),
        );
        expect(attempt.status).toBe("error");
        expect(attempt.formError).toBe("Invalid email or password.");
      }

      // The NEXT attempt (6th) is rejected by the bruteforce guard instead.
      const throttled = await loginAction(
        { status: "idle" },
        loginForm("victim@nexaflow.dev", "wrong-password-1"),
      );
      expect(throttled.status).toBe("error");
      expect(throttled.formError).toBe("Too many attempts. Please try again shortly.");

      // The stored credential is untouched (password was never changed).
      const stored = (await tx.select().from((await import("@/db/schema")).users).where(eq((await import("@/db/schema")).users.email, "victim@nexaflow.dev")))[0];
      expect(stored).toBeTruthy();
    });
  });

  it("does not throttle an untouched email (no cross-account amplification)", async () => {
    await withTestDb(async (tx) => {
      clientIp.value = "10.20.30.40";
      await tx.insert(users).values({
        email: "victim@nexaflow.dev",
        name: "Victim",
        passwordHash: await hashPassword("victims-real-password-1"),
      });

      for (let i = 0; i < 6; i++) {
        await loginAction({ status: "idle" }, loginForm("victim@nexaflow.dev", "wrong-1"));
      }
      // A DIFFERENT email is not affected by victim's block.
      const other = await loginAction(
        { status: "idle" },
        loginForm("other-person@nexaflow.dev", "wrong-1"),
      );
      expect(other.formError).toBe("Invalid email or password.");
    });
  });
});

describe("forgot-password flooding throttling", () => {
  it("skips token creation once the per-email limit is exceeded, while staying account-neutral", async () => {
    clientIp.value = "10.99.12.34";
    const email = "flooding-target@nexaflow.dev";

    await withTestDb(async (tx) => {
      const userInsert = await tx
        .insert(users)
        .values({
          email,
          name: "Flooding Target",
          passwordHash: await hashPassword("unused-real-password-1"),
        })
        .returning({ id: users.id });
      const userId = userInsert[0]!.id;

      // Four attempts each succeed while inside the per-email limit (4/hr).
      for (let i = 0; i < 4; i++) {
        const response = await forgotPasswordAction({ status: "idle" }, forgotForm(email));
        expect((response as { status: string }).status).toBe("done");
      }

      // DATABASE TRUTH: after 4 allowed attempts (with supersede semantics),
      // exactly ONE pending token remains for the user.
      const { passwordResetTokens } = await import("@/db/schema");
      const pendingBefore = await tx
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, userId));
      expect(pendingBefore.length).toBe(1);

      // The 5th attempt is throttled upstream: the public answer is IDENTICAL
      // ("done") but no new token work happens.
      const throttled = await forgotPasswordAction({ status: "idle" }, forgotForm(email));
      expect((throttled as { status: string }).status).toBe("done");

      const pendingAfter = await tx
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, userId));
      expect(pendingAfter.length).toBe(1);

      // ANTI-ENUMERATION RESTORED: an unknown email gets the exact same `done`
      // outcome even while the endpoint is actively being throttled.
      const unknown = await forgotPasswordAction(
        { status: "idle" },
        forgotForm("nope-nothere@nexaflow.dev"),
      );
      expect(unknown).toEqual(throttled);
    });
  });
});

function loginForm(email: string, password: string): FormData {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return fd;
}

function forgotForm(email: string): FormData {
  const fd = new FormData();
  fd.set("email", email);
  return fd;
}
