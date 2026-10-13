"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/server/auth/password";
import { getCurrentAuth, requireAuth } from "@/server/auth";
import { assertForgotAllowed } from "@/server/security/rate-limit";
import { sendEmail } from "@/server/email";
import { buildEmailChangeVerificationEmail } from "@/server/email/templates/email-change-verification";
import { buildEmailVerificationEmail } from "@/server/email/templates/email-verification";
import { buildPasswordResetEmail } from "@/server/email/templates/password-reset";
import { changeEmailWithToken, createEmailChangeToken } from "@/server/data/email-change";
import {
  createEmailVerificationToken,
  verifyEmailWithToken,
} from "@/server/data/email-verification";
import {
  createPasswordResetToken,
  resetPasswordWithToken,
} from "@/server/data/password-reset";
import {
  forgotPasswordSchema,
  requestEmailChangeSchema,
  resetPasswordSchema,
  securityTokenSchema,
} from "@/server/validation/security";

const GENERIC_ERROR = "Something went wrong on our side. Please try again.";

function readString(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}

function toFieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * Deliver-after-persist helper. Template builders may require APP_URL while
 * the provider config may be absent — either way, that must never corrupt the
 * already-persisted credential or leak an enumeration signal. It soft-fails
 * into `ok:false` (with a single operational warning), never throws to the
 * caller, so public flows stay neutral and auth flows show honest
 * "unavailable" instead of a misleading generic error.
 */
async function attemptDelivery(
  build: () => ReturnType<typeof buildPasswordResetEmail>,
): Promise<{ ok: boolean }> {
  let message: ReturnType<typeof buildPasswordResetEmail>;
  try {
    message = build();
  } catch (error) {
    // getAppUrl()/config unavailable during build — delivery could not happen.
    console.warn(
      `[security] email delivery unavailable during message build (${
        error instanceof Error ? error.message.slice(0, 80) : "config"
      })`,
    );
    return { ok: false };
  }
  const send = await sendEmail(message);
  if (!send.ok) {
    console.warn(`[security] email delivery unavailable (reason=${send.reason})`);
    return { ok: false };
  }
  return { ok: true };
}

/* ====================================================================== */
/*                         A. Password recovery                           */
/* ====================================================================== */

export type ForgotPasswordState = { status: "idle" | "done" | "error"; formError?: string };

/**
 * Anti-enumeration: the response is ALWAYS the same neutral result regardless
 * of whether the account exists, whether email is configured, or whether the
 * send fails. A reset token is only created+sent on that exact account's
 * behalf when the user row exists, and any provider failure is internal-only.
 */
export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({ email: readString(formData.get("email")) });
  if (!parsed.success) {
    // Invalid email format is a form-level problem, not account-information.
    return { status: "error", formError: "Enter a valid email address." };
  }

  // Abuse resistance: throttle cost (token creation + outbound email) for
  // flooding, while still returning the account-neutral `done` response so
  // the endpoint remains non-enumerative even under throttling.
  if ((await assertForgotAllowed(parsed.data.email)) !== "allowed") {
    return { status: "done" };
  }

  // Neutralize timing: always do the symmetric lookup + branch.
  try {
    const rows = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);

    const user = rows[0];
    if (user) {
      const { rawToken, expiresAt } = await createPasswordResetToken(user.id); // persist FIRST
      // AFTER persist: attempt delivery (never in the transaction).
      const sent = await attemptDelivery(() =>
        buildPasswordResetEmail({ to: user.email, rawToken, expiresAt }),
      );
      if (!sent.ok) {
        // Persisted credential stays valid; the action's outcome stays identical
        // to the unknown-account branch = anti-enumeration preserved even under
        // missing provider configuration.
        console.warn(
          "[security] password-reset email delivery unavailable; credential persisted for the account",
        );
      }
    }

    // Identical user-facing result regardless of branch taken above.
    return { status: "done" };
  } catch (error) {
    console.error("[security] forgot-password failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }
}

export type ResetPasswordState =
  | { status: "idle" | "error"; formError?: string; fieldErrors?: Record<string, string[]> };

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = securityTokenSchema.safeParse(readString(formData.get("token")));
  if (!token.success) {
    return { status: "error", formError: "This reset link is no longer valid." };
  }

  const parsed = resetPasswordSchema.safeParse({
    newPassword: readString(formData.get("newPassword")),
    confirmPassword: readString(formData.get("confirmPassword")),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error) };
  }

  const newPasswordHash = await hashPassword(parsed.data.newPassword);

  let outcome;
  try {
    outcome = await resetPasswordWithToken(token.data, newPasswordHash);
  } catch (error) {
    console.error("[security] reset-password failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  if (!outcome.ok) {
    const message = outcome.reason === "expired" ? "This reset link has expired." : "This reset link is no longer valid.";
    return { status: "error", formError: message };
  }

  redirect("/login");
}

/* ====================================================================== */
/*                       B. Email verification                            */
/* ====================================================================== */

export type VerifyEmailState = { status: "idle" | "error" | "already_verified"; formError?: string };

/**
 * Consumed ONLY when the user clicks the confirm button (not on page load —
 * email security gateway pre-fetchers cannot burn one-time links this way).
 */
export async function verifyEmailAction(
  _prev: VerifyEmailState,
  formData: FormData,
): Promise<VerifyEmailState> {
  const token = securityTokenSchema.safeParse(readString(formData.get("token")));
  if (!token.success) {
    return { status: "error", formError: "This verification link is no longer valid." };
  }

  let outcome;
  try {
    outcome = await verifyEmailWithToken(token.data);
  } catch (error) {
    console.error("[security] verify-email failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  if (!outcome.ok) {
    const message = outcome.reason === "expired" ? "This verification link has expired." : "This verification link is no longer valid.";
    return { status: "error", formError: message };
  }

  revalidatePath("/account");
  revalidatePath("/", "layout");
  if (outcome.alreadyVerified) return { status: "already_verified" };
  redirect("/dashboard");
}

export type ResendVerificationState = {
  status: "idle" | "error" | "sent" | "unavailable" | "already_verified";
  formError?: string;
};

/** Authenticated resend: identity comes from the session, never the form. */
export async function resendVerificationEmailAction(
  _prev: ResendVerificationState,
): Promise<ResendVerificationState> {
  const auth = await requireAuth();

  if (auth.user && (await isEmailVerified(auth.user.id))) {
    return { status: "already_verified" };
  }

  try {
    const { rawToken, expiresAt } = await createEmailVerificationToken(auth.user.id);
    const sent = await attemptDelivery(() =>
      buildEmailVerificationEmail({ to: auth.user.email, rawToken, expiresAt }),
    );
    return { status: sent.ok ? "sent" : "unavailable" };
  } catch (error) {
    console.error("[security] resend-verification failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }
}

/* ====================================================================== */
/*                         C. Change email address                        */
/* ====================================================================== */

async function isEmailVerified(userId: string): Promise<boolean> {
  const rows = await db
    .select({ emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.emailVerifiedAt != null;
}

export type RequestEmailChangeState =
  | { status: "idle" | "error" | "sent" | "unavailable"; formError?: string; fieldErrors?: Record<string, string[]> };

/**
 * STAGE 1: request a change-email pending change + verification to the NEW
 * address. The CURRENT email remains authoritative until verification.
 */
export async function requestEmailChangeAction(
  _prev: RequestEmailChangeState,
  formData: FormData,
): Promise<RequestEmailChangeState> {
  const parsed = requestEmailChangeSchema.safeParse({ email: readString(formData.get("email")) });
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error) };
  }

  const auth = await requireAuth();
  const newEmail = parsed.data.email;

  if (newEmail === auth.user.email) {
    return { status: "error", fieldErrors: { email: ["That's already your current email address."] } };
  }

  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, newEmail))
    .limit(1);
  if (taken.length > 0) {
    return { status: "error", fieldErrors: { email: ["An account with this email already exists."] } };
  }

  try {
    const { rawToken, expiresAt } = await createEmailChangeToken(auth.user.id, newEmail); // persist FIRST
    const sent = await attemptDelivery(() =>
      buildEmailChangeVerificationEmail({
        to: newEmail,
        currentEmail: auth.user.email,
        rawToken,
        expiresAt,
      }),
    );

    revalidatePath("/account");
    return { status: sent.ok ? "sent" : "unavailable" };
  } catch (error) {
    console.error("[security] change-email request failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }
}

export type VerifyEmailChangeState = { status: "idle" | "error"; formError?: string };

/**
 * STAGE 2: consume only when the user clicks confirm from the new address's
 * link (never on page load). Atomic replacement of consumers' `users.email`.
 */
export async function verifyEmailChangeAction(
  _prev: VerifyEmailChangeState,
  formData: FormData,
): Promise<VerifyEmailChangeState> {
  const token = securityTokenSchema.safeParse(readString(formData.get("token")));
  if (!token.success) {
    return { status: "error", formError: "This verification link is no longer valid." };
  }

  let outcome;
  try {
    outcome = await changeEmailWithToken(token.data);
  } catch (error) {
    console.error("[security] verify-email-change failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  if (!outcome.ok) {
    const message =
      outcome.reason === "expired"
        ? "This verification link has expired."
        : outcome.reason === "email_taken"
          ? "That email address is no longer available."
          : "This verification link is no longer valid.";
    return { status: "error", formError: message };
  }

  revalidatePath("/account");
  revalidatePath("/", "layout");
  redirect("/account");
}

/** Read-only helper for the /forgot-password page's neutral submission copy. */
export async function getOptionalAuthForSecurityPages() {
  return getCurrentAuth();
}
