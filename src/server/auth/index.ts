import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  memberships,
  organizations,
  sessions,
  users,
  type organizationRoleEnum,
} from "@/db/schema";
import { createEmailVerificationToken } from "@/server/data/email-verification";
import { sendEmail } from "@/server/email";
import { buildEmailVerificationEmail } from "@/server/email/templates/email-verification";
import { AppError } from "@/server/errors";
import { slugCandidate, slugifyOrganizationName } from "@/server/organizations";
import type { LoginInput, SignupInput } from "@/server/validation/auth";
import { hashPassword, verifyPassword } from "./password";
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  createSessionRecord,
  hashSessionToken,
  invalidateSessionByRawToken,
  loadCurrentSessionWithUser,
  setSessionCookie,
  switchActiveOrganization,
  type DbLike,
} from "./session";

export type OrganizationRole = (typeof organizationRoleEnum.enumValues)[number];

/**
 * The single, server-side authentication context that every future
 * tenant-scoped data function will receive. It intentionally contains no
 * password_hash and no token_hash — those never leave the auth modules.
 */
export type AuthContext = {
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string; slug: string };
  membership: { id: string; role: OrganizationRole };
  session: { id: string; expiresAt: Date };
};

const SLUG_MAX_ATTEMPTS = 20;

/** PostgreSQL SQLSTATE for unique_violation. */
const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === PG_UNIQUE_VIOLATION
  );
}

/* ------------------------------------------------------------------------ */
/*                                  context                                 */
/* ------------------------------------------------------------------------ */

/**
 * Resolves the full tenant context for the current request, or null.
 * Fail-closed: ANY inconsistency (missing/idle session, expired session,
 * missing membership, cross-tenant active org) returns unauthenticated
 * state — never partial state.
 */
export async function getCurrentAuth(): Promise<AuthContext | null> {
  const resolved = await loadCurrentSessionWithUser();
  if (!resolved) return null;

  const { session, user } = resolved;

  // The session proves who the user is; the membership proves which
  // organization they may act as. Joining on BOTH the user and the session's
  // active organization means a non-member active org resolves to no row.
  const rows = await db
    .select({
      membership: { id: memberships.id, role: memberships.role },
      organization: {
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
      },
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(
      and(
        eq(memberships.userId, session.userId),
        eq(memberships.organizationId, session.activeOrganizationId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    // Active organization is not one of this user's memberships — exactly the
    // cross-tenant case the sessions→memberships composite FK normally makes
    // impossible. Fail closed rather than trusting the active org.
    return null;
  }

  return {
    user,
    organization: row.organization,
    membership: row.membership,
    session: { id: session.id, expiresAt: session.expiresAt },
  };
}

/** Redirects to /login when unauthenticated; otherwise returns the context. */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getCurrentAuth();
  if (!ctx) redirect("/login");
  return ctx;
}

/**
 * Tenant-aware context. Identical to requireAuth today because the active
 * organization is stored on the session and verified against membership in
 * the same query — there is no untrusted tenant input to resolve. Kept as
 * the named boundary future data-layer code depends on.
 */
export async function requireContext(): Promise<AuthContext> {
  return requireAuth();
}

/**
 * Role gate evaluated against the CURRENT membership of an already-resolved
 * AuthContext. Because the role predicate is identical to the one inside
 * `requireRole()` below (just with context pre-supplied), every
 * authorization decision remains bit-for-bit the same — only the context
 * resolution step is split. Request-boundary callers keep using
 * `requireRole()`; testbeds and composed higher-layer flows can assert the
 * identical gating on a context they supplied upward (no mocking, no
 * auth-request-context shortcuts).
 */
export function requireRoleWithContext(
  ctx: AuthContext,
  ...roles: OrganizationRole[]
): AuthContext {
  if (!roles.includes(ctx.membership.role)) {
    throw new AppError("forbidden", "You do not have access to this action.");
  }
  return ctx;
}

/** Role gate evaluated against the authenticated membership. */
export async function requireRole(
  ...roles: OrganizationRole[]
): Promise<AuthContext> {
  const ctx = await requireContext();
  return requireRoleWithContext(ctx, ...roles);
}

/* ------------------------------------------------------------------------ */
/*                                   signup                                 */
/* ------------------------------------------------------------------------ */

export type SignupResult = { ok: true } | { ok: false; error: "email_taken" };

/**
 * Post-signup verification email. Runs ONLY after the account+organization+
 * membership+session transaction has committed. Any failure is functional
 * (the user can resend from /account) — it must never roll back a successfully
 * created account.
 */
async function sendSignupVerificationEmail(
  userId: string,
  email: string,
): Promise<void> {
  try {
    const { rawToken, expiresAt } = await createEmailVerificationToken(userId);
    const message = buildEmailVerificationEmail({
      to: email,
      rawToken,
      expiresAt,
    });
    const send = await sendEmail(message);
    if (!send.ok) {
      console.warn(
        `[auth] signup verification email unavailable (reason=${send.reason}); resend available on /account`,
      );
    }
  } catch (error) {
    console.error("[auth] signup verification email error", error);
  }
}

/**
 * Atomic onboarding: user + organization + owner membership + session in one
 * transaction. Slug collisions are handled by catching the unique violation
 * from attempt N and retrying with candidate N+1 — a naive check-then-insert
 * races under concurrent signups, so organizations.unique(slug) remains the
 * final arbiter. The whole attempt is one transaction, so a failed attempt
 * rolls back cleanly before the next candidate.
 */
export async function signup(input: SignupInput): Promise<SignupResult> {
  const passwordHash = await hashPassword(input.password);
  const baseSlug = slugifyOrganizationName(input.organizationName);

  for (let attempt = 0; attempt < SLUG_MAX_ATTEMPTS; attempt++) {
    const slug = slugCandidate(baseSlug, attempt);

    let sessionSecret: { rawToken: string; expiresAt: Date; userId: string };
    try {
      sessionSecret = await db.transaction(async (tx) => {
        const existingUser = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, input.email))
          .limit(1);
        if (existingUser.length > 0) {
          throw new EmailTakenError();
        }

        const [user] = await tx
          .insert(users)
          .values({
            name: input.name,
            email: input.email,
            passwordHash,
          })
          .returning({ id: users.id });

        const [organization] = await tx
          .insert(organizations)
          .values({ name: input.organizationName, slug })
          .returning({ id: organizations.id });

        await tx.insert(memberships).values({
          userId: user.id,
          organizationId: organization.id,
          role: "owner",
        });

        const created = await createSessionRecord(tx, {
          userId: user.id,
          activeOrganizationId: organization.id,
        });
        return { ...created, userId: user.id };
      });
    } catch (error) {
      if (error instanceof EmailTakenError) {
        // Clean pre-check and the unique index agree the email exists.
        return { ok: false, error: "email_taken" };
      }
      if (isUniqueViolation(error)) {
        continue; // slug or email claimed concurrently → try next candidate
      }
      throw error;
    }

    await setSessionCookie(sessionSecret.rawToken, sessionSecret.expiresAt);
    await sendSignupVerificationEmail(sessionSecret.userId, input.email);
    return { ok: true };
  }

  // Unreachable in practice, but never loop forever on pathological data.
  throw new AppError("conflict", "Could not allocate an organization slug.");
}

/** Internal control-flow marker that short-circuits the signup transaction. */
class EmailTakenError extends Error {
  constructor() {
    super("email already registered");
    this.name = "EmailTakenError";
  }
}

/* ------------------------------------------------------------------------ */
/*                                   login                                  */
/* ------------------------------------------------------------------------ */

export type LoginResult = { ok: true } | { ok: false; error: "invalid" };

/**
 * Credential verification with enumeration-safe failure. A deterministic
 * dummy scrypt hash is verified when the email is unknown, so the response
 * timing of "no such user" cannot be distinguished from "wrong password".
 */
export async function login(input: LoginInput): Promise<LoginResult> {
  const rows = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  const user = rows[0];
  const hashToCheck =
    user?.passwordHash ??
    "scrypt.16384.8.1.c2FsdHNhbHRzYWx0c2FsdA.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  const verified = await verifyPassword(input.password, hashToCheck);
  if (!user || !verified) return { ok: false, error: "invalid" };

  // Deterministic default organization: the oldest membership.
  const membershipRows = await db
    .select({ organizationId: memberships.organizationId })
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .orderBy(memberships.createdAt)
    .limit(1);

  const activeOrganizationId = membershipRows[0]?.organizationId;
  if (!activeOrganizationId) {
    // Account integrity failure (user without any membership) — fail closed.
    throw new AppError("internal", "Account has no organization membership.");
  }

  const created = await createSessionRecord(db, {
    userId: user.id,
    activeOrganizationId,
  });
  await setSessionCookie(created.rawToken, created.expiresAt);

  return { ok: true };
}

/* ------------------------------------------------------------------------ */
/*                                   logout                                 */
/* ------------------------------------------------------------------------ */

export async function logout(): Promise<void> {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value;

  // Idempotent: missing cookie or an already-deleted session is not an error.
  if (rawToken) {
    await invalidateSessionByRawToken(rawToken);
  }
  await clearSessionCookie();
}

/* ------------------------------------------------------------------------ */
/*                           organization switching                          */
/* ------------------------------------------------------------------------ */

export type SwitchResult = { ok: true } | { ok: false; error: "not_a_member" };

/**
 * Changes the active organization on the current session. Membership is
 * verified server-side against the authenticated user BEFORE the update —
 * the organization id is the only client-supplied input, and it is used
 * purely as a lookup key, never as trusted tenant state.
 */
export async function switchOrganization(
  organizationId: string,
): Promise<SwitchResult> {
  const ctx = await requireAuth();

  const result = await switchActiveOrganization(
    ctx.session.id,
    ctx.user.id,
    organizationId,
  );

  if (!result.ok) {
    if (result.reason === "session_missing") redirect("/login");
    return { ok: false, error: "not_a_member" };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------------ */
/*                     verification helpers (non-sensitive)                  */
/* ------------------------------------------------------------------------ */

/**
 * Whether the current session cookie maps to a live, unexpired session row.
 * Used by the tamper-detection verification path; the normal request path
 * fails closed identically through hash lookup inside getCurrentAuth.
 */
export async function sessionExistsForCurrentCookie(): Promise<boolean> {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return false;
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.tokenHash, hashSessionToken(rawToken)))
    .limit(1);
  return rows.length > 0;
}

export { hashSessionToken };
export type { DbLike };
