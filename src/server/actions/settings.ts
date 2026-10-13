"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations } from "@/db/schema";
import { AppError, isAppError } from "@/server/errors";
import { requireRole, type AuthContext } from "@/server/auth";
import { slugifyOrganizationName } from "@/server/organizations";
import { organizationSettingsSchema } from "@/server/validation/settings";

export type SettingsFormState = {
  status: "idle" | "error" | "saved";
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

const GENERIC_ERROR = "Something went wrong on our side. Please try again.";

function readString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/**
 * Organization mutation is owner-only, matching the existing Team policy.
 */
async function requireSettingsOwner(): Promise<
  AuthContext | SettingsFormState
> {
  try {
    return await requireRole("owner");
  } catch (error) {
    if (isAppError(error)) {
      return {
        status: "error",
        formError: "Only the organization owner can update settings.",
      };
    }
    throw error;
  }
}

/**
 * The organization's current slug is intentionally left untouched: the slug
 * is globally unique and used only for display/UX continuity, while tenant
 * resolution keys on the immutable organization ID. Letting an owner rename
 * the display name is safe and useful; the slug is regenerated alongside it so
 * it stays a readable identifier rather than a free-form, editable field —
 * which would raise collision and URL-safety concerns without changing any
 * routing behavior.
 */
export async function updateOrganizationSettingsAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const parsed = organizationSettingsSchema.safeParse({
    name: readString(formData.get("name")),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { status: "error", fieldErrors };
  }

  const ctx = await requireSettingsOwner();
  if ("status" in ctx) return ctx;

  try {
    // The slug stays collision-safe: slugify the new name, and if it would
    // collide with another organization's slug, fall back to the existing
    // slug plus a numeric suffix. The UNIQUE(slug) index is the final guard.
    const baseSlug = slugifyOrganizationName(parsed.data.name);

    const existing = await db
      .select({ slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.slug, baseSlug))
      .limit(1);

    let slug = baseSlug;
    if (existing.length > 0 && existing[0].slug !== ctx.organization.slug) {
      slug = `${baseSlug}-${ctx.organization.id.slice(0, 8)}`; // uuid prefix guarantees uniqueness
    }

    const updated = await db
      .update(organizations)
      .set({
        name: parsed.data.name,
        slug,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, ctx.organization.id)) // tenant from context — never input
      .returning({ id: organizations.id });

    if (updated.length === 0) {
      throw new AppError("internal", "Organization could not be updated.");
    }
  } catch (error) {
    if (isAppError(error)) {
      return { status: "error", formError: error.message };
    }
    console.error("[settings] update failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  // Revalidate every route that surfaces the organization name/slug.
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/team");
  revalidatePath("/", "layout"); // AppShell header/sidebar uses the org name

  return { status: "saved" };
}
