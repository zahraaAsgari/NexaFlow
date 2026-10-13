import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { emailChangeTokens, users } from "@/db/schema";
import {
  generateSecurityToken,
  hashSecurityToken,
} from "@/server/security/tokens";

/**
 * Pending change-email credentials.
 *
 * The CURRENT email remains authoritative until the new address proves
 * control: `users.email` is never touched until verification succeeds. Only
 * the token hash is stored; `new_email` IS persisted because it is the pending
 * change (not a secret). One active pending change per user (a second request
 * supersedes the first). The final verification is a single transaction:
 * re-validate the target address is still free (race-safe), claim via the
 * `used_at IS NULL` guard, replace `users.email`, set `email_verified_at`,
 * and stamp the token — exactly once.
 */

export const EMAIL_CHANGE_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

export type PendingEmailChange = {
  id: string;
  newEmail: string;
  expiresAt: Date;
};

/** Any active pending change for a user, or null. */
export async function getPendingEmailChange(
  userId: string,
): Promise<PendingEmailChange | null> {
  const rows = await db
    .select({
      id: emailChangeTokens.id,
      newEmail: emailChangeTokens.newEmail,
      expiresAt: emailChangeTokens.expiresAt,
    })
    .from(emailChangeTokens)
    .where(
      and(
        eq(emailChangeTokens.userId, userId),
        isNull(emailChangeTokens.usedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function createEmailChangeToken(
  userId: string,
  newEmail: string,
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = generateSecurityToken();
  const expiresAt = new Date(Date.now() + EMAIL_CHANGE_LIFETIME_MS);

  await db.transaction(async (tx) => {
    await tx
      .delete(emailChangeTokens)
      .where(
        and(eq(emailChangeTokens.userId, userId), isNull(emailChangeTokens.usedAt)),
      );
    await tx.insert(emailChangeTokens).values({
      userId,
      newEmail,
      tokenHash: hashSecurityToken(rawToken),
      expiresAt,
    });
  });

  return { rawToken, expiresAt };
}

export type ChangeEmailOutcome =
  | { ok: true; newEmail: string }
  | {
      ok: false;
      reason:
        | "invalid"
        | "expired"
        | "consumed"
        | "email_taken"
        | "no_account";
    };

/**
 * Atomically verifies the change-email token and swaps the account email to
 * the pending new address. The uniqueness of `users.email` is re-checked
 * inside the transaction because another account could have claimed that
 * address after the pending change was created.
 */
export async function changeEmailWithToken(
  rawToken: string,
): Promise<ChangeEmailOutcome> {
  const tokenHash = hashSecurityToken(rawToken);

  try {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: emailChangeTokens.id,
          userId: emailChangeTokens.userId,
          newEmail: emailChangeTokens.newEmail,
          expiresAt: emailChangeTokens.expiresAt,
          usedAt: emailChangeTokens.usedAt,
        })
        .from(emailChangeTokens)
        .where(eq(emailChangeTokens.tokenHash, tokenHash))
        .limit(1);

      const token = rows[0];
      if (!token) return { ok: false, reason: "invalid" } as const;
      if (token.usedAt) return { ok: false, reason: "consumed" } as const;
      if (token.expiresAt <= new Date()) {
        return { ok: false, reason: "expired" } as const;
      }

      // Race-safe: the address must STILL be available right now.
      const taken = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, token.newEmail))
        .limit(1);
      if (taken.length > 0) return { ok: false, reason: "email_taken" } as const;

      const claimed = await tx
        .update(emailChangeTokens)
        .set({ usedAt: new Date() })
        .where(
          and(eq(emailChangeTokens.id, token.id), isNull(emailChangeTokens.usedAt)),
        )
        .returning({ id: emailChangeTokens.id });

      if (claimed.length === 0) return { ok: false, reason: "consumed" } as const;

      const updated = await tx
        .update(users)
        .set({
          email: token.newEmail,
          emailVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, token.userId))
        .returning({ id: users.id });

      if (updated.length === 0) return { ok: false, reason: "no_account" } as const;

      return { ok: true, newEmail: token.newEmail } as const;
    });
  } catch {
    return { ok: false, reason: "email_taken" };
  }
}
