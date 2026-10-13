"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import * as projectData from "@/server/data/projects";
import { isAppError } from "@/server/errors";
import { requireRole, type AuthContext } from "@/server/auth";
import { issuesToFieldErrors } from "@/server/validation/clients";
import { projectFormSchema } from "@/server/validation/projects";

export type ProjectFormState = {
  status: "idle" | "error";
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

const GENERIC_ERROR = "Something went wrong on our side. Please try again.";
/** Project management is an owner/admin operation; members read only. */
const MANAGEMENT_ROLES = ["owner", "admin"] as const;

function readString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/**
 * Owner/admin gate. requireRole throws on insufficient role; that is mapped
 * to a safe message here, while unauthenticated still redirects to /login.
 */
async function requireProjectManager(): Promise<AuthContext | ProjectFormState> {
  try {
    return await requireRole(...MANAGEMENT_ROLES);
  } catch (error) {
    if (isAppError(error)) {
      return {
        status: "error",
        formError: "You don't have permission to manage projects.",
      };
    }
    throw error; // redirects / unexpected errors propagate
  }
}

function parseProjectForm(formData: FormData) {
  return projectFormSchema.safeParse({
    clientId: readString(formData.get("clientId")),
    name: readString(formData.get("name")),
    description: readString(formData.get("description")),
    status: readString(formData.get("status")) || "active",
  });
}

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const parsed = parseProjectForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error) };
  }

  const ctx = await requireProjectManager();
  if ("status" in ctx) return ctx;

  try {
    await projectData.createProject(ctx, {
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      description: parsed.data.description,
    });
  } catch (error) {
    if (isAppError(error)) {
      // Foreign/unknown client: surfaced as a field error that never reveals
      // whether the client exists in another organization.
      return { status: "error", fieldErrors: { clientId: ["Client not found."] } };
    }
    console.error("[projects] create failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect("/projects?notice=created");
}

export async function updateProjectAction(
  projectId: string,
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  // The id is bound server-side from the URL; still validated before use.
  const id = z.uuid().safeParse(projectId);
  if (!id.success) {
    return { status: "error", formError: "Project not found." };
  }

  const parsed = parseProjectForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error) };
  }

  const ctx = await requireProjectManager();
  if ("status" in ctx) return ctx;

  try {
    const updated = await projectData.updateProject(ctx, id.data, parsed.data);
    if (!updated) {
      // Cross-tenant or deleted ids read as "not found" — never "forbidden".
      return { status: "error", formError: "Project not found." };
    }
  } catch (error) {
    if (isAppError(error)) {
      return { status: "error", fieldErrors: { clientId: ["Client not found."] } };
    }
    console.error("[projects] update failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(`/projects/${id.data}?notice=updated`);
}

export async function deleteProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const id = z.uuid().safeParse(readString(formData.get("projectId")));
  if (!id.success) {
    return { status: "error", formError: "Project not found." };
  }

  const ctx = await requireProjectManager();
  if ("status" in ctx) return ctx;

  try {
    // A foreign or already-deleted id simply removes nothing; the resulting
    // list state is identical either way, so no existence is leaked.
    await projectData.deleteProject(ctx, id.data);
  } catch (error) {
    console.error("[projects] delete failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect("/projects?notice=deleted");
}
