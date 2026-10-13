"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { isAppError } from "@/server/errors";
import { requireAuth } from "@/server/auth";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import {
  accountProfileNameSchema,
  changePasswordSchema,
} from "@/server/validation/account";

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

export type AccountFormState = {
  status: "idle" | "error" | "saved";
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

const GENERIC_ERROR = "Something went wrong on our side. Please try again.";

function readString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function toFieldErrors(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

/**
 * Profile update for the AUTHENTICATED user — NAME ONLY.
 *
 * Email changes are deliberately NOT applied here: they must complete the
 * verified change-email flow (pending credential sent to the NEW address;
 * current email remains authoritative until verification). This action can
 * therefore never be used to swap `users.email` without proof-of-control.
 *
 * Personal identity, not organization-scoped: the target user is
 * `auth.user.id` from requireAuth() — never a form-provided user id.
 */
export async function updateAccountProfileAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = accountProfileNameSchema.safeParse({
    name: readString(formData.get("name")),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error) };
  }

  const auth = await requireAuth();
  const userId = auth.user.id;

  try {
    const updated = await db
      .update(users)
      .set({
        name: parsed.data.name,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId)) // user from trusted context — never input
      .returning({ id: users.id });

    if (updated.length === 0) {
      console.error("[account] profile update affected no rows");
      return { status: "error", formError: GENERIC_ERROR };
    }
  } catch (error) {
    if (isAppError(error)) {
      return { status: "error", formError: error.message };
    }
    console.error("[account] profile update failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  // Refresh both the current page and every route that displays identity.
  revalidatePath("/account");
  revalidatePath("/settings");
  revalidatePath("/", "layout");

  return { status: "saved" };
}

export type PasswordChangeState = {
  status: "idle" | "error" | "saved";
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

/**
 * Password change for the AUTHENTICATED user.
 *
 * Verification order is deliberate: validate the confirmation match first
 * (cheap, no DB), then verify the CURRENT password against the stored scrypt
 * hash as a second factor with the existing timing-safe verifier, then re-hash
 * the new secret with the same shared parameters, then update only this user's
 * hash inside the same transaction that invalidates other sessions.
 *
 * SESSION SECURITY DECISION (Option A): the session in use right now is
 * preserved so the user is not abruptly logged out, while every OTHER session
 * belonging to this user is deleted — a password change must assume a stale
 * leaked credential on another device can no longer stay active. Only this
 * user's other sessions are touched; no rotation, no new sessions.
 */
export async function changeAccountPasswordAction(
  _prev: PasswordChangeState,
  formData: FormData,
): Promise<PasswordChangeState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: readString(formData.get("currentPassword")),
    newPassword: readString(formData.get("newPassword")),
    confirmPassword: readString(formData.get("confirmPassword")),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error) };
  }

  const auth = await requireAuth();
  const userId = auth.user.id;

  // Load the stored hash server-side only; it never reaches the response.
  const rows = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const storedHash = rows[0]?.passwordHash ?? null;

  const verified = storedHash
    ? await verifyPassword(parsed.data.currentPassword, storedHash)
    : false;

  if (!verified) {
    // Deliberately does not distinguish between "wrong current password" and a
    // state where no hash could be resolved — the response is identical.
    return {
      status: "error",
      fieldErrors: { currentPassword: ["Current password is incorrect."] },
    };
  }

  const newPasswordHash = await hashPassword(parsed.data.newPassword);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
        .where(eq(users.id, userId));

      // Invalidate every OTHER session belonging to this user; keep this one.
      await tx
        .delete(sessions)
        .where(and(eq(sessions.userId, userId), ne(sessions.id, auth.session.id)));
    });
  } catch (error) {
    console.error("[account] password change failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  revalidatePath("/account");
  revalidatePath("/", "layout");

  return { status: "saved" };
}
