import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import { invitations, memberships, organizations, users } from "@/db/schema";
import type { AuthContext } from "@/server/auth";
import { ownedByOrg } from "./tenant";

/**
 * Invitation data access.
 *
 * TOKEN MODEL (mirrors the session architecture)
 *   recipient link : raw 256-bit random token, shown once to the inviter
 *   database       : SHA-256(rawToken) in invitations.token_hash
 *   lookup         : hash the incoming token, then match on the hash
 * A database read therefore never yields a usable invitation link. The raw
 * token is returned exactly once — by createInvitation — and is never logged.
 *
 * TENANT MODEL
 *   Creation/listing/revocation are constrained by ownedByOrg(ctx, …).
 *   Acceptance is deliberately NOT ctx-scoped: the recipient may be anonymous
 *   or a member of a different organization. The invitation row itself is the
 *   sole authority for which organization and role are granted.
 */

/** Invitations expire 7 days after creation (see report; no prior convention). */
export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export type PendingInvitation = {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  expiresAt: Date;
  createdAt: Date;
  invitedByName: string | null;
};

/** Pending (unaccepted, unexpired) invitations for the active organization. */
export async function listPendingInvitations(
  ctx: AuthContext,
): Promise<PendingInvitation[]> {
  return db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
      invitedByName: users.name,
    })
    .from(invitations)
    .leftJoin(users, eq(users.id, invitations.invitedByUserId))
    .where(
      and(
        ownedByOrg(ctx, invitations.organizationId),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(invitations.createdAt));
}

export type CreateInvitationResult =
  | { ok: true; rawToken: string; expiresAt: Date }
  | { ok: false; reason: "already_member" };

/**
 * Creates an invitation for the ACTIVE organization. Returns the raw token
 * exactly once so the caller can build a link — it is never persisted.
 *
 * Policy: one pending invitation per (organization, email). Re-inviting the
 * same address replaces the previous pending invitation inside the same
 * transaction, so old links stop working (the partial unique index in the
 * database backs this up).
 */
export async function createInvitation(
  ctx: AuthContext,
  input: { email: string; role: "admin" | "member" },
): Promise<CreateInvitationResult> {
  // Already a member of THIS organization? Nothing to invite.
  const existingMember = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(eq(users.email, input.email), ownedByOrg(ctx, memberships.organizationId)),
    )
    .limit(1);
  if (existingMember.length > 0) return { ok: false, reason: "already_member" };

  const rawToken = generateInvitationToken();
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);

  await db.transaction(async (tx) => {
    // Supersede any previous pending invitation for this address.
    await tx
      .delete(invitations)
      .where(
        and(
          eq(invitations.organizationId, ctx.organization.id),
          eq(invitations.email, input.email),
          isNull(invitations.acceptedAt),
        ),
      );

    await tx.insert(invitations).values({
      organizationId: ctx.organization.id, // tenant from context — never input
      email: input.email,
      role: input.role,
      tokenHash: hashInvitationToken(rawToken),
      expiresAt,
      invitedByUserId: ctx.user.id,
    });
  });

  return { ok: true, rawToken, expiresAt };
}

/** Revokes (deletes) a pending invitation belonging to the active org. */
export async function revokeInvitation(
  ctx: AuthContext,
  invitationId: string,
): Promise<boolean> {
  const rows = await db
    .delete(invitations)
    .where(
      and(
        eq(invitations.id, invitationId),
        ownedByOrg(ctx, invitations.organizationId),
        isNull(invitations.acceptedAt),
      ),
    )
    .returning({ id: invitations.id });
  return rows.length > 0;
}

export type ResolvedInvitation = {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  role: "owner" | "admin" | "member";
  expiresAt: Date;
  acceptedAt: Date | null;
};

/**
 * Resolves an invitation from a RAW token (hashed before lookup). Returns the
 * row even when expired/accepted so the UI can explain precisely why it is no
 * longer usable — validity is decided by the caller / acceptInvitation.
 */
export async function getInvitationByToken(
  rawToken: string,
): Promise<ResolvedInvitation | null> {
  const rows = await db
    .select({
      id: invitations.id,
      organizationId: invitations.organizationId,
      organizationName: organizations.name,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
    })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .where(eq(invitations.tokenHash, hashInvitationToken(rawToken)))
    .limit(1);
  return rows[0] ?? null;
}

export type AcceptOutcome =
  | { ok: true; organizationId: string }
  | {
      ok: false;
      reason: "invalid" | "expired" | "consumed" | "already_member";
    };

/**
 * Consumes an invitation and creates the membership for `userId` atomically.
 *
 * Replay protection: the UPDATE that stamps accepted_at is itself guarded by
 * `accepted_at IS NULL`, so two concurrent acceptances race on one row and
 * exactly one wins — the loser sees zero updated rows and is rejected. The
 * membership is created in the same transaction, so acceptance and membership
 * always succeed or fail together.
 *
 * The organization and role come ONLY from the invitation row.
 */
export async function acceptInvitation(
  rawToken: string,
  userId: string,
): Promise<AcceptOutcome> {
  const tokenHash = hashInvitationToken(rawToken);

  try {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: invitations.id,
          organizationId: invitations.organizationId,
          role: invitations.role,
          expiresAt: invitations.expiresAt,
          acceptedAt: invitations.acceptedAt,
        })
        .from(invitations)
        .where(eq(invitations.tokenHash, tokenHash))
        .limit(1);

      const invitation = rows[0];
      if (!invitation) return { ok: false, reason: "invalid" } as const;
      if (invitation.acceptedAt) return { ok: false, reason: "consumed" } as const;
      if (invitation.expiresAt <= new Date()) {
        return { ok: false, reason: "expired" } as const;
      }

      // Already a member (e.g. added out-of-band): consume without duplicating.
      const existing = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.organizationId, invitation.organizationId),
          ),
        )
        .limit(1);

      // Claim the invitation first; the guard makes this the concurrency gate.
      const claimed = await tx
        .update(invitations)
        .set({ acceptedAt: new Date(), updatedAt: new Date() })
        .where(
          and(eq(invitations.id, invitation.id), isNull(invitations.acceptedAt)),
        )
        .returning({ id: invitations.id });

      if (claimed.length === 0) {
        return { ok: false, reason: "consumed" } as const;
      }

      if (existing.length > 0) {
        return { ok: false, reason: "already_member" } as const;
      }

      await tx.insert(memberships).values({
        userId,
        organizationId: invitation.organizationId, // authority = invitation row
        role: invitation.role,
      });

      return { ok: true, organizationId: invitation.organizationId } as const;
    });
  } catch {
    // A unique-violation here means a concurrent path created the membership.
    return { ok: false, reason: "already_member" };
  }
}
