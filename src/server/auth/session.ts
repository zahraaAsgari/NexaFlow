import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, asc, eq, lte } from "drizzle-orm";

import { db } from "@/db";
import { memberships, organizations, sessions, users } from "@/db/schema";

/**
 * Opaque-token sessions.
 *
 * TOKEN MODEL
 *   browser cookie : raw 256-bit random token (the only place it exists)
 *   database       : SHA-256(rawToken) in sessions.token_hash
 *   lookup         : hash the cookie value, then match on the hash
 * A database read therefore never yields a usable cookie value. The raw token
 * is returned exactly once — by createSessionRecord — straight into the
 * cookie-setting call, and is never logged, rendered, or persisted.
 *
 * COOKIE MUTATION BOUNDARY
 *   Next.js only permits cookies().set()/delete() inside a Server Action or a
 *   Route Handler. Everything in this module that runs during a normal page
 *   render (loadCurrentSessionWithUser) is therefore strictly cookie-read-only
 *   and performs sliding renewal in the database alone. Refreshing the
 *   cookie's Max-Age is handled by middleware, which is allowed to write
 *   cookies on any request (see src/middleware.ts).
 */
export const SESSION_COOKIE_NAME = "nexaflow_session";

export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE_MAX_AGE_SECONDS = Math.floor(
  SESSION_LIFETIME_MS / 1000,
);
/**
 * Sliding renewal: once the remaining lifetime drops below 7 days the
 * database expiry is extended by a full 30 days — so active users are not
 * written to on every request, only near expiry. The token value itself is
 * never rotated, which keeps concurrent requests and multiple tabs race-free:
 * two requests renewing at once simply write an equivalent expiry.
 */
const RENEW_IF_REMAINING_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url"); // 256-bit, URL/cookie-safe
}

export type DbLike = Pick<
  typeof db,
  "select" | "update" | "delete" | "insert"
>;

export type CreatedSession = {
  /** Raw token — goes into the cookie only. Never store or log this. */
  rawToken: string;
  expiresAt: Date;
};

/**
 * Inserts the session row and hands back the raw token for the cookie.
 * Cookie writing is a separate step (setSessionCookie) because a transaction
 * body may run in contexts where cookie mutation is illegal; callers in
 * Server Actions pair the two immediately.
 */
export async function createSessionRecord(
  tx: DbLike,
  input: { userId: string; activeOrganizationId: string },
): Promise<CreatedSession> {
  const rawToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  await tx.insert(sessions).values({
    userId: input.userId,
    activeOrganizationId: input.activeOrganizationId,
    tokenHash: hashSessionToken(rawToken),
    expiresAt,
  });

  return { rawToken, expiresAt };
}

/**
 * Writes the session cookie. Only legal inside a Server Action or Route
 * Handler — callers are signup/login (Server Actions).
 *
 * Attributes:
 *   httpOnly  – unreadable from JavaScript, so XSS cannot exfiltrate it
 *   secure    – HTTPS-only in production (off locally so http://127.0.0.1 works)
 *   sameSite  – "lax": sent on top-level navigations (so returning to the app
 *               stays signed in) but not on cross-site subrequests
 *   path "/"  – the whole application needs it
 *   maxAge    – matches the database lifetime; the database remains authoritative
 *   no Domain – host-only cookie; never shared with sibling subdomains
 */
export async function setSessionCookie(
  rawToken: string,
  expiresAt: Date,
): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    expires: expiresAt,
  });
}

/** Removes the session cookie. Server Action / Route Handler only. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

/**
 * Resolves the current session and user, or null.
 *
 * COOKIE-READ-ONLY: safe to call during a normal Server Component render.
 * Expiry handling and sliding renewal touch the database only; a stale cookie
 * left in the browser is harmless because the database is authoritative and an
 * unmatched/expired token simply resolves to null (fail closed).
 */
export async function loadCurrentSessionWithUser(): Promise<{
  session: {
    id: string;
    userId: string;
    activeOrganizationId: string;
    expiresAt: Date;
  };
  user: { id: string; email: string; name: string };
} | null> {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  // The browser holds the token; the database only ever sees its hash.
  const tokenHash = hashSessionToken(rawToken);

  const now = new Date();
  const rows = await db
    .select({
      session: {
        id: sessions.id,
        userId: sessions.userId,
        activeOrganizationId: sessions.activeOrganizationId,
        expiresAt: sessions.expiresAt,
      },
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row) return null; // unknown or tampered token → unauthenticated

  if (row.session.expiresAt <= now) {
    // Expired sessions never authenticate. The row is removed here; the stale
    // cookie is cleared on the next Server Action (logout) or simply expires.
    await db.delete(sessions).where(eq(sessions.id, row.session.id));
    return null;
  }

  // Sliding expiration — database only, no cookie mutation in the read path.
  const remaining = row.session.expiresAt.getTime() - now.getTime();
  if (remaining < RENEW_IF_REMAINING_MS) {
    const extended = new Date(now.getTime() + SESSION_LIFETIME_MS);
    await db
      .update(sessions)
      .set({ expiresAt: extended, updatedAt: now })
      .where(eq(sessions.id, row.session.id));
    row.session.expiresAt = extended;
  }

  return row;
}

/** Deletes a session by its raw token. Idempotent by design. */
export async function invalidateSessionByRawToken(
  rawToken: string,
): Promise<void> {
  await db
    .delete(sessions)
    .where(eq(sessions.tokenHash, hashSessionToken(rawToken)));
}

/** Removes every expired session. Safe to run opportunistically. */
export async function deleteExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lte(sessions.expiresAt, new Date()));
}

export type UserOrganization = {
  membershipId: string;
  role: "owner" | "admin" | "member";
  organization: { id: string; name: string; slug: string };
};

/** All organizations the user belongs to (oldest membership first). */
export async function listUserOrganizations(
  userId: string,
): Promise<UserOrganization[]> {
  return db
    .select({
      membershipId: memberships.id,
      role: memberships.role,
      organization: {
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
      },
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt));
}

export type SwitchOrganizationResult =
  | { ok: true }
  | { ok: false; reason: "not_a_member" | "session_missing" };

/**
 * Changes the active organization on the *current* session. Membership is
 * verified BEFORE the update and the composite FK
 * sessions(user_id, active_organization_id) → memberships is the second wall,
 * so activating an organization the user does not belong to is impossible.
 */
export async function switchActiveOrganization(
  sessionId: string,
  userId: string,
  organizationId: string,
): Promise<SwitchOrganizationResult> {
  const membership = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (membership.length === 0) return { ok: false, reason: "not_a_member" };

  const updated = await db
    .update(sessions)
    .set({ activeOrganizationId: organizationId, updatedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({ id: sessions.id });

  if (updated.length === 0) return { ok: false, reason: "session_missing" };
  return { ok: true };
}
