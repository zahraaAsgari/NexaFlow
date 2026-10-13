import { z } from "zod";

/**
 * Invitation input contracts.
 *
 * Roles assignable by invitation are deliberately limited to admin|member.
 * "owner" is excluded because the product has no ownership-transfer flow and
 * the organization is modelled with a single owner — the server rejects it
 * even if a client submits it.
 */
export const INVITABLE_ROLES = ["admin", "member"] as const;

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

/** Email normalization matches the authentication convention: trim + lowercase. */
export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.").max(254)),
  role: z.enum(INVITABLE_ROLES, {
    message: "Select a valid role.",
  }),
});

export const revokeInvitationSchema = z.object({
  invitationId: z.uuid("Invalid invitation."),
});

/**
 * Invitation tokens are base64url of 32 random bytes (43 chars). Validating
 * the shape before any database work keeps malformed input away from queries.
 */
export const invitationTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{20,128}$/, "Invalid invitation.");

/** Account creation via an invitation — mirrors the signup password policy. */
export const acceptWithAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Your name is required.")
    .max(100, "Name is too long."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password is too long."),
});
