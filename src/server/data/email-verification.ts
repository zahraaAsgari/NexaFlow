import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { emailVerificationTokens, users } from "@/db/schema";
import {
  generateSecurityToken,
  hashSecurityToken,
} from "@/server/security/tokens";

/**
 * Email-verification credentials.
 *
 * One active verification token per user (request a new one → supersede all
 * active). Only the token hash is persisted. Consumption is a single
 * transaction: claim via `used_at IS NULL`, set `users.email_verified_at`,
 * return the outcome. If the user is already verified, the flow is handled
 * gracefully (idempotent success) without corrupting state.
 */

export const EMAIL_VERIFICATION_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function createEmailVerificationToken(userId: string): Promise<{
  rawToken: string;
  expiresAt: Date;
}> {
  const rawToken = generateSecurityToken();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_LIFETIME_MS);

  await db.transaction(async (tx) => {
    await tx
      .delete(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.userId, userId),
          isNull(emailVerificationTokens.usedAt),
        ),
      );
    await tx.insert(emailVerificationTokens).values({
      userId,
      tokenHash: hashSecurityToken(rawToken),
      expiresAt,
    });
  });

  return { rawToken, expiresAt };
}

export type VerifyEmailOutcome =
  | { ok: true; alreadyVerified: boolean }
  | { ok: false; reason: "invalid" | "expired" | "consumed" | "no_account" };

/** Atomically consumes a verification token and marks the email verified. */
export async function verifyEmailWithToken(
  rawToken: string,
): Promise<VerifyEmailOutcome> {
  const tokenHash = hashSecurityToken(rawToken);

  try {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: emailVerificationTokens.id,
          userId: emailVerificationTokens.userId,
          expiresAt: emailVerificationTokens.expiresAt,
          usedAt: emailVerificationTokens.usedAt,
        })
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.tokenHash, tokenHash))
        .limit(1);

      const token = rows[0];
      if (!token) return { ok: false, reason: "invalid" } as const;
      if (token.usedAt) return { ok: false, reason: "consumed" } as const;
      if (token.expiresAt <= new Date()) {
        return { ok: false, reason: "expired" } as const;
      }

      const claimed = await tx
        .update(emailVerificationTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(emailVerificationTokens.id, token.id),
            isNull(emailVerificationTokens.usedAt),
          ),
        )
        .returning({ id: emailVerificationTokens.id });

      if (claimed.length === 0) return { ok: false, reason: "consumed" } as const;

      const before = await tx
        .select({ emailVerifiedAt: users.emailVerifiedAt })
        .from(users)
        .where(eq(users.id, token.userId))
        .limit(1);

      if (before.length === 0) return { ok: false, reason: "no_account" } as const;
      const alreadyVerified = before[0].emailVerifiedAt !== null;

      await tx
        .update(users)
        .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, token.userId));

      return { ok: true, alreadyVerified } as const;
    });
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
