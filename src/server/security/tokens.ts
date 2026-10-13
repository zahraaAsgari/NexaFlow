import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * Shared cryptographic primitives for one-time account credentials
 * (password reset, email verification, email change).
 *
 * Scope is intentionally narrow: generation and hashing only. Each flow
 * remains responsible for its own expiration, database record, and single-use
 * consumption, so a password-reset token can never mint verification, an
 * email-verification token can never reset a password, and an email-change
 * token can never reset a password. Only the crypto mechanics are shared.
 *
 * This does NOT change the existing invitations/session token utilities —
 * those proven flows keep their own implementations (no behavioral change).
 */

export function generateSecurityToken(): string {
  return randomBytes(32).toString("base64url"); // 256-bit, URL-safe
}

export function hashSecurityToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
