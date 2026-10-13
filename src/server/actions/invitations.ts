"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { invitations, memberships, users } from "@/db/schema";
import * as invitationData from "@/server/data/invitations";
import { sendEmail } from "@/server/email";
import { buildInvitationEmail } from "@/server/email/templates/invitation";
import { isAppError } from "@/server/errors";
import {
  getCurrentAuth,
  requireRole,
  switchOrganization,
  type AuthContext,
} from "@/server/auth";
import { hashPassword } from "@/server/auth/password";
import {
  createSessionRecord,
  setSessionCookie,
} from "@/server/auth/session";
import {
  acceptWithAccountSchema,
  inviteMemberSchema,
  invitationTokenSchema,
  revokeInvitationSchema,
} from "@/server/validation/invitations";

const GENERIC_ERROR = "Something went wrong on our side. Please try again.";

/** PostgreSQL unique_violation, possibly wrapped by the driver/ORM. */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      (current as { code: unknown }).code === "23505"
    ) {
      return true;
    }
    current =
      typeof current === "object" && current !== null && "cause" in current
        ? (current as { cause: unknown }).cause
        : null;
  }
  return false;
}

export type InviteFormState = {
  status: "idle" | "error" | "created";
  formError?: string;
  fieldErrors?: Record<string, string[]>;
  /** Shown ONCE to the inviter so the link can be delivered manually.
   *  Never persisted, never logged — the database holds only its hash. */
  inviteUrl?: string;
  invitedEmail?: string;
  /**
   * Delivery result for the transactional invite email, returned only after
   * the invitation was persisted. "sent" → provider accepted the message;
   * "unavailable" → no delivery was made (config absent or provider failed) —
   * the one-time manual link remains the recovery path and is never
   * falsely presented as delivered.
   */
  delivery?: "sent" | "unavailable";
};

function readString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/**
 * Inviting is an owner-only operation, matching the existing Team policy
 * (member management already requires requireRole("owner")).
 */
type GateFailure = { status: "error"; formError: string };

async function requireInviter(): Promise<AuthContext | GateFailure> {
  try {
    return await requireRole("owner");
  } catch (error) {
    if (isAppError(error)) {
      return {
        status: "error",
        formError: "Only the organization owner can invite members.",
      };
    }
    throw error;
  }
}

export async function inviteMemberAction(
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const parsed = inviteMemberSchema.safeParse({
    email: readString(formData.get("email")),
    role: readString(formData.get("role")),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { status: "error", fieldErrors };
  }

  const ctx = await requireInviter();
  if ("status" in ctx) return ctx;

  let result: invitationData.CreateInvitationResult;
  try {
    result = await invitationData.createInvitation(ctx, parsed.data);
  } catch (error) {
    console.error("[invitations] create failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  if (!result.ok) {
    return {
      status: "error",
      fieldErrors: { email: ["That person is already a member."] },
    };
  }

  revalidatePath("/team");

  // EMAIL DELIVERY (outside the DB transaction, after successful persist:
  // never hold a Postgres transaction open on an external provider call,
  // and never roll back a valid invitation just because delivery failed).
  let delivery: "sent" | "unavailable" = "unavailable";
  try {
    const message = buildInvitationEmail({
      to: parsed.data.email,
      organizationName: ctx.organization.name,
      inviterName: ctx.user.name,
      rawToken: result.rawToken,
      expiresAt: result.expiresAt,
    });
    const send = await sendEmail(message);
    delivery = send.ok ? "sent" : "unavailable";
    if (!send.ok) {
      // Operational signal only — never the token, recipient, body, or internals.
      console.warn(
        `[invitations] email delivery unavailable (reason=${send.reason}) for a persisted invitation`,
      );
    }
  } catch (error) {
    // Any unexpected template/build failure downgrades to link-remaining.
    console.error("[invitations] email delivery error", error);
    delivery = "unavailable";
  }

  return {
    status: "created",
    delivery,
    invitedEmail: parsed.data.email,
    inviteUrl: `/invite/${result.rawToken}`,
  };
}

export type RevokeInvitationState = { status: "idle" | "error"; formError?: string };

export async function revokeInvitationAction(
  _prev: RevokeInvitationState,
  formData: FormData,
): Promise<RevokeInvitationState> {
  const parsed = revokeInvitationSchema.safeParse({
    invitationId: readString(formData.get("invitationId")),
  });
  if (!parsed.success) {
    return { status: "error", formError: "Invitation not found." };
  }

  const ctx = await requireInviter();
  if ("status" in ctx) return ctx;

  try {
    await invitationData.revokeInvitation(ctx, parsed.data.invitationId);
  } catch (error) {
    console.error("[invitations] revoke failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  revalidatePath("/team");
  return { status: "idle" };
}

export type AcceptState = {
  status: "idle" | "error";
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

function acceptFailureMessage(
  reason: "invalid" | "expired" | "consumed" | "already_member",
): string {
  switch (reason) {
    case "expired":
      return "This invitation has expired.";
    case "consumed":
      return "This invitation has already been used.";
    case "already_member":
      return "You are already a member of this organization.";
    default:
      return "This invitation is no longer valid.";
  }
}

/**
 * Acceptance by a user who is ALREADY signed in. The signed-in account's email
 * must match the invited address — an invitation is never transferable.
 */
export async function acceptInvitationAction(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const token = invitationTokenSchema.safeParse(readString(formData.get("token")));
  if (!token.success) {
    return { status: "error", formError: "This invitation is no longer valid." };
  }

  const auth = await getCurrentAuth();
  if (!auth) redirect(`/login`);

  const invitation = await invitationData.getInvitationByToken(token.data);
  if (!invitation) {
    return { status: "error", formError: "This invitation is no longer valid." };
  }
  if (invitation.email !== auth.user.email.trim().toLowerCase()) {
    return {
      status: "error",
      formError: "This invitation belongs to a different email address.",
    };
  }

  let outcome: invitationData.AcceptOutcome;
  try {
    outcome = await invitationData.acceptInvitation(token.data, auth.user.id);
  } catch (error) {
    console.error("[invitations] accept failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  if (!outcome.ok) {
    return { status: "error", formError: acceptFailureMessage(outcome.reason) };
  }

  // Make the newly joined organization active using the existing verified
  // switcher (it re-checks membership server-side).
  await switchOrganization(outcome.organizationId);

  revalidatePath("/team");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/**
 * Acceptance by a recipient who has NO account yet: create the account and the
 * membership, then sign them in. This reuses the existing password hashing,
 * session creation and cookie helpers — it is an onboarding path into an
 * EXISTING organization, not a second authentication system, and deliberately
 * never creates an organization.
 */
export async function acceptInvitationWithAccountAction(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const token = invitationTokenSchema.safeParse(readString(formData.get("token")));
  if (!token.success) {
    return { status: "error", formError: "This invitation is no longer valid." };
  }

  const parsed = acceptWithAccountSchema.safeParse({
    name: readString(formData.get("name")),
    password: readString(formData.get("password")),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { status: "error", fieldErrors };
  }

  const invitation = await invitationData.getInvitationByToken(token.data);
  if (!invitation) {
    return { status: "error", formError: "This invitation is no longer valid." };
  }
  if (invitation.acceptedAt) {
    return { status: "error", formError: "This invitation has already been used." };
  }
  if (invitation.expiresAt <= new Date()) {
    return { status: "error", formError: "This invitation has expired." };
  }

  // If an account already exists for the invited address, the recipient must
  // sign in instead — we never touch an existing account's credentials.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, invitation.email))
    .limit(1);
  if (existing.length > 0) {
    return {
      status: "error",
      formError: "An account already exists for this email. Please sign in to accept.",
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  let session: { rawToken: string; expiresAt: Date };
  try {
    session = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          name: parsed.data.name,
          email: invitation.email, // identity comes from the invitation
          passwordHash,
        })
        .returning({ id: users.id });

      // Claim + membership happen INLINE on this same transaction/connection.
      // (Calling the shared acceptInvitation here would open a second
      // transaction on a different pooled connection, which could not see this
      // uncommitted user row.) The `accepted_at IS NULL` guard is the
      // concurrency gate: exactly one acceptance can win.
      const claimed = await tx
        .update(invitations)
        .set({ acceptedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(invitations.id, invitation.id),
            isNull(invitations.acceptedAt),
          ),
        )
        .returning({ id: invitations.id });
      if (claimed.length === 0) {
        throw new Error("accept_failed:consumed");
      }

      await tx.insert(memberships).values({
        userId: created.id,
        organizationId: invitation.organizationId, // authority = invitation row
        role: invitation.role,
      });

      return createSessionRecord(tx, {
        userId: created.id,
        activeOrganizationId: invitation.organizationId,
      });
    });
  } catch (error) {
    // A concurrent request may have created the account for this same invited
    // address first; the users.email unique index is the arbiter. Drizzle wraps
    // the driver error, so walk the cause chain looking for SQLSTATE 23505.
    if (isUniqueViolation(error)) {
      return {
        status: "error",
        formError:
          "An account already exists for this email. Please sign in to accept.",
      };
    }
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("accept_failed:")) {
      const reason = message.split(":")[1] as
        | "invalid"
        | "expired"
        | "consumed"
        | "already_member";
      return { status: "error", formError: acceptFailureMessage(reason) };
    }
    console.error("[invitations] accept-with-account failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  await setSessionCookie(session.rawToken, session.expiresAt);
  redirect("/dashboard");
}
