"use server";

import { redirect } from "next/navigation";

import * as auth from "@/server/auth";
import {
  assertLoginAllowed,
  isSignupLimited,
  recordLoginFailure,
} from "@/server/security/rate-limit";
import {
  loginSchema,
  signupSchema,
  switchOrganizationSchema,
} from "@/server/validation/auth";

/** Field-level errors keyed by form field name, safe to render. */
export type FormErrors = Record<string, string[]>;

export type AuthFormState = {
  status: "idle" | "error";
  formError?: string;
  fieldErrors?: FormErrors;
};

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

function parseFailure(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): FormErrors {
  const fieldErrors: FormErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

function readString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    name: readString(formData.get("name")),
    email: readString(formData.get("email")),
    password: readString(formData.get("password")),
    organizationName: readString(formData.get("organizationName")),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parseFailure(parsed.error) };
  }

  // Coarse account-creation flood control (account creation = scrypt hashing
  // and organization provisioning, so unlimited signup is a cost amplifier).
  if (await isSignupLimited()) {
    return {
      status: "error",
      formError: "Too many attempts. Please try again shortly.",
    };
  }

  let result: auth.SignupResult;
  try {
    result = await auth.signup(parsed.data);
  } catch (error) {
    console.error("[auth] signup failed", error);
    return {
      status: "error",
      formError: "Something went wrong on our side. Please try again.",
    };
  }

  if (!result.ok) {
    return {
      status: "error",
      fieldErrors: { email: ["An account with this email already exists."] },
    };
  }

  redirect("/dashboard");
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: readString(formData.get("email")),
    password: readString(formData.get("password")),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parseFailure(parsed.error) };
  }

  // Abuse resistance: reject brute-force patterns before password work.
  const throttle = await assertLoginAllowed(parsed.data.email);
  if (throttle !== "allowed") {
    return {
      status: "error",
      formError: "Too many attempts. Please try again shortly.",
    };
  }

  let result: auth.LoginResult;
  try {
    result = await auth.login(parsed.data);
  } catch (error) {
    console.error("[auth] login failed", error);
    return {
      status: "error",
      formError: "Something went wrong on our side. Please try again.",
    };
  }

  if (!result.ok) {
    await recordLoginFailure(parsed.data.email);
    return { status: "error", formError: INVALID_CREDENTIALS_MESSAGE };
  }

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await auth.logout();
  redirect("/login");
}

export async function switchOrganizationAction(
  _prev: { status: "idle" | "error" },
  formData: FormData,
): Promise<{ status: "idle" | "error" }> {
  const parsed = switchOrganizationSchema.safeParse({
    organizationId: readString(formData.get("organizationId")),
  });
  if (!parsed.success) return { status: "error" };

  const result = await auth.switchOrganization(parsed.data.organizationId);
  if (!result.ok) return { status: "error" };
  return { status: "idle" };
}
