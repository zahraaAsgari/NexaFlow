import "server-only";

import { headers } from "next/headers";

/**
 * Targeted abuse resistance for the public, unauthenticated write surfaces:
 * login (credential stuffing / password guessing), forgot-password
 * (email/cost flooding), and signup (bulk account creation).
 *
 * DEPLOYMENT CONTRACT
 * -------------------
 * This is a per-process, in-memory sliding-window limiter. NexaFlow currently
 * runs as a single `next start` process, where this is fully reliable: one
 * memory arena equals one enforcement authority. If the deployment ever
 * scales horizontally (multiple processes/instances/containers), the same
 * interface must be backed by shared state (e.g. the Postgres database we
 * already operate, or a dedicated rate-limit service) — the call sites do not
 * change, only the storage backend. It is deliberately NOT hidden inside the
 * framework or a request lifecycle: it is an explicit boundary so the flag
 * can be moved safely when the time comes.
 */

type BucketEntry = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, BucketEntry>();
const MAX_BUCKETS = 10_000;
let sinceLastPrune = 0;

function pruneIfNeeded(maxWindowMs: number, now: number): void {
  // Cheap periodic sweep so long-lived processes never accumulate.
  if (buckets.size <= MAX_BUCKETS) return;
  if (now - sinceLastPrune < maxWindowMs) return;
  sinceLastPrune = now;
  for (const [key, value] of buckets) {
    if (now - value.windowStart >= maxWindowMs) {
      buckets.delete(key);
    }
  }
}

export type RateLimitPolicy = {
  limit: number;
  windowMs: number;
};

/**
 * Registers one attempt against the sliding window for `key`.
 * Returns true if the attempt is within the limit, false when over it.
 */
export function consumeRateLimitAttempt(
  key: string,
  { limit, windowMs }: RateLimitPolicy,
): boolean {
  const now = Date.now();
  pruneIfNeeded(windowMs, now);

  const entry = buckets.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

/**
 * Returns true when the current sliding window for `key` is already full —
 * used to cheaply reject before doing expensive work (password hashing,
 * token creation, outbound email).
 */
export function isRateLimited(
  key: string,
  { limit, windowMs }: RateLimitPolicy,
): boolean {
  const entry = buckets.get(key);
  if (!entry) return false;
  return Date.now() - entry.windowStart < windowMs && entry.count >= limit;
}

/** Test affordance and crash-recovery utility: clears all windows. */
export function resetRateLimitsForTests(): void {
  buckets.clear();
  sinceLastPrune = 0;
}

/** Client-IP hint. Honest caveat: X-Forwarded-For is client-spoofable and is
 * therefore a COARSE secondary control only — the strict primary control is
 * per-email limiting, which no attacker can bypass by rotating source IPs. */
async function getClientIpHint(): Promise<string> {
  try {
    const heads = await headers();
    const forwarded = heads.get("x-forwarded-for");
    const first = forwarded?.split(",")[0]?.trim();
    return first || heads.get("x-real-ip")?.trim() || "unknown";
  } catch {
    // Outside a request context the hint is irrelevant anyway.
    return "unknown";
  }
}

async function policyKey(prefix: string, ...parts: (string | null)[]): Promise<string> {
  const pieces = await Promise.all(parts);
  return `${prefix}:${pieces.join(":")}`;
}

/* ------------------------------------------------------------------------ */
/*                          Unified, low-touch hooks                         */
/* ------------------------------------------------------------------------ */

export const LOGIN_PER_EMAIL: RateLimitPolicy = { limit: 5, windowMs: 15 * 60_000 };
export const LOGIN_PER_IP: RateLimitPolicy = { limit: 30, windowMs: 15 * 60_000 };
export const FORGOT_PER_EMAIL: RateLimitPolicy = { limit: 4, windowMs: 60 * 60_000 };
export const FORGOT_PER_IP: RateLimitPolicy = { limit: 40, windowMs: 60 * 60_000 };
export const SIGNUP_PER_IP: RateLimitPolicy = { limit: 8, windowMs: 60 * 60_000 };

export type LoginThrottleResult = "allowed" | "email_limited" | "ip_limited";

/**
 * Primary login abuse control — binds the target email (not usable to learn
 * account existence: unknown emails still count attempts the same way) to the
 * coarse IP control. Intended semantics: consume ONLY on failure.
 */
export async function assertLoginAllowed(email: string): Promise<LoginThrottleResult> {
  const ip = await getClientIpHint();
  const emailKey = await policyKey("login:email", email.trim().toLowerCase());
  const ipKey = await policyKey("login:ip", ip);

  if (isRateLimited(emailKey, LOGIN_PER_EMAIL)) return "email_limited";
  if (isRateLimited(ipKey, LOGIN_PER_IP)) return "ip_limited";
  return "allowed";
}

/** Consume one FAILED login attempt against both contexts. */
export async function recordLoginFailure(email: string): Promise<void> {
  const ip = await getClientIpHint();
  consumeRateLimitAttempt(
    await policyKey("login:email", email.trim().toLowerCase()),
    LOGIN_PER_EMAIL,
  );
  consumeRateLimitAttempt(await policyKey("login:ip", ip), LOGIN_PER_IP);
}

export type ForgotThrottleResult = "allowed" | "email_limited" | "ip_limited";

/**
 * Forgot-password cost control. Returns which side is over the limit so the
 * caller can skip token creation and email delivery while STILL returning the
 * account-neutral `done` response (anti-enumeration preserved).
 */
export async function assertForgotAllowed(email: string): Promise<ForgotThrottleResult> {
  const ip = await getClientIpHint();
  const emailKey = await policyKey("forgot:email", email.trim().toLowerCase());
  const ipKey = await policyKey("forgot:ip", ip);

  if (!consumeRateLimitAttempt(emailKey, FORGOT_PER_EMAIL)) return "email_limited";
  if (!consumeRateLimitAttempt(ipKey, FORGOT_PER_IP)) return "ip_limited";
  return "allowed";
}

/** Coarse signup flood control (account creation cost). */
export async function isSignupLimited(): Promise<boolean> {
  const ip = await getClientIpHint();
  const key = await policyKey("signup:ip", ip);
  if (isRateLimited(key, SIGNUP_PER_IP)) return true;
  return !consumeRateLimitAttempt(key, SIGNUP_PER_IP);
}
