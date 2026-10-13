import "server-only";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { passwordResetTokens, sessions, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { resetPasswordWithToken } from "@/server/data/password-reset";
import {
  createMembership,
  createOrganization,
  createSession,
  createUser,
} from "@/server/test/fixtures";
import { resetTestDb, withTestDb } from "@/server/test/db-harness";

/**
 * TRUE CONCURRENT single-use token consumption against the real test database.
 *
 * No serialization, no artificial queueing: both attempts are issued together
 * via Promise.all against the production `db` pool. The ONLY concurrency
 * protection under test is the production `used_at IS NULL` conditional
 * UPDATE inside `resetPasswordWithToken`'s transaction.
 *
 * PostgreSQL behavior relied upon (documented, not simulated): under READ
 * COMMITTED the second UPDATE blocks on the row lock held by the first, and
 * once the first commits it re-evaluates the WHERE predicate against the
 * committed row — finds `used_at` set — and matches zero rows.
 */

afterAll(async () => {
  await resetTestDb();
});

describe("concurrent single-use token consumption", () => {
  it("exactly one of two simultaneous attempts wins; the token is consumed once; the password matches exactly one attempt", async () => {
    await withTestDb(async (tx) => {
      const user = await createUser(tx, { email: "race@nexaflow.dev" });
      const org = await createOrganization(tx);
      await createMembership(tx, {
        userId: user.id,
        organizationId: org.id,
        role: "owner",
      });
      await createSession(tx, {
        userId: user.id,
        activeOrganizationId: org.id,
      });

      const { createPasswordResetToken } = await import(
        "@/server/data/password-reset"
      );
      const { rawToken } = await createPasswordResetToken(user.id);

      const hashA = await hashPassword("parallel-winner-A-1");
      const hashB = await hashPassword("parallel-winner-B-1");

      // Both attempts are in flight simultaneously against the real pool.
      const [a, b] = await Promise.all([
        resetPasswordWithToken(rawToken, hashA),
        resetPasswordWithToken(rawToken, hashB),
      ]);

      const outcomes = [a, b];
      const winners = outcomes.filter((o) => o.ok);
      const losers = outcomes.filter((o) => !o.ok);

      // EXACTLY one winner.
      expect(winners.length).toBe(1);
      expect(losers.length).toBe(1);

      // The loser is reported as consumed/invalid — never a silent success.
      const loserReason = losers[0];
      if (!loserReason.ok) {
        expect(["consumed", "invalid"]).toContain(loserReason.reason);
      }

      // DATABASE TRUTH: the token is consumed exactly once.
      const tokenRows = await tx
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, user.id));
      expect(tokenRows.length).toBe(1);
      expect(tokenRows[0]?.usedAt).not.toBeNull();

      // DATABASE TRUTH: every session for the user was invalidated (the reset
      // contract), and the password matches EXACTLY ONE of the two attempts.
      const remainingSessions = await tx
        .select()
        .from(sessions)
        .where(eq(sessions.userId, user.id));
      expect(remainingSessions.length).toBe(0);

      const refreshed = (
        await tx.select().from(users).where(eq(users.id, user.id))
      )[0];
      expect(refreshed).toBeTruthy();

      const matchesA = await verifyPassword("parallel-winner-A-1", refreshed.passwordHash);
      const matchesB = await verifyPassword("parallel-winner-B-1", refreshed.passwordHash);
      expect([matchesA, matchesB].filter(Boolean).length).toBe(1);
    });
  });

  it("is repeatable: a second concurrent pair behaves identically", async () => {
    await withTestDb(async (tx) => {
      const user = await createUser(tx, { email: "race-2@nexaflow.dev" });
      const org = await createOrganization(tx);
      await createMembership(tx, {
        userId: user.id,
        organizationId: org.id,
        role: "owner",
      });

      const { createPasswordResetToken } = await import(
        "@/server/data/password-reset"
      );
      const { rawToken } = await createPasswordResetToken(user.id);

      const [a, b] = await Promise.all([
        resetPasswordWithToken(rawToken, await hashPassword("second-A-1")),
        resetPasswordWithToken(rawToken, await hashPassword("second-B-1")),
      ]);

      expect([a, b].filter((o) => o.ok).length).toBe(1);
      expect([a, b].filter((o) => !o.ok).length).toBe(1);

      const rows = await tx
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, user.id));
      expect(rows[0]?.usedAt).not.toBeNull();
    });
  });
});
