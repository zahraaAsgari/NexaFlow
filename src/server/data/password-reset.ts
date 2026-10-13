import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { passwordResetTokens, sessions, users } from "@/db/schema";
import {
  generateSecurityToken,
  hashSecurityToken,
} from "@/server/security/tokens";

/**
 * Password-recovery credentials.
 *
 * One active reset token per user: requesting a new one supersedes every
 * still-unused token for that user. Only the token hash is stored. The final
 * reset is atomic: claim the token via a `used_at IS NULL` guard, update the
 * password hash, and invalidate every session for that user — all inside one
 * transaction, exactly once.
 */

export const PASSWORD_RESET_LIFETIME_MS = 60 * 60 * 1000; // 1 hour

export async function createPasswordResetToken(userId: string): Promise<{
  rawToken: string;
  expiresAt: Date;
}> {
  const rawToken = generateSecurityToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_LIFETIME_MS);

  await db.transaction(async (tx) => {
    await tx
      .delete(passwordResetTokens)
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
    await tx.insert(passwordResetTokens).values({
      userId,
      tokenHash: hashSecurityToken(rawToken),
      expiresAt,
    });
  });

  return { rawToken, expiresAt };
}

export type ResetPasswordOutcome =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "consumed" | "no_account" };

/**
 * Atomically consumes a reset token and replaces the password. Claim via the
 * `used_at IS NULL` guard so two concurrent resets have exactly one winner.
 * ALL sessions for the user are invalidated in the same transaction — the
 * reset token is never a session.
 */
export async function resetPasswordWithToken(
  rawToken: string,
  newPasswordHash: string,
): Promise<ResetPasswordOutcome> {
  const tokenHash = hashSecurityToken(rawToken);

  try {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: passwordResetTokens.id,
          userId: passwordResetTokens.userId,
          expiresAt: passwordResetTokens.expiresAt,
          usedAt: passwordResetTokens.usedAt,
        })
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash))
        .limit(1);

      const token = rows[0];
      if (!token) return { ok: false, reason: "invalid" } as const;
      if (token.usedAt) return { ok: false, reason: "consumed" } as const;
      if (token.expiresAt <= new Date()) {
        return { ok: false, reason: "expired" } as const;
      }

      const claimed = await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.id, token.id),
            isNull(passwordResetTokens.usedAt),
          ),
        )
        .returning({ id: passwordResetTokens.id });

      if (claimed.length === 0) return { ok: false, reason: "consumed" } as const;

      const updated = await tx
        .update(users)
        .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
        .where(eq(users.id, token.userId))
        .returning({ id: users.id });

      if (updated.length === 0) return { ok: false, reason: "no_account" } as const;

      await tx.delete(sessions).where(eq(sessions.userId, token.userId));

      return { ok: true } as const;
    });
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
