"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import * as taskData from "@/server/data/tasks";
import { isAppError } from "@/server/errors";
import { requireRole, type AuthContext } from "@/server/auth";
import { issuesToFieldErrors } from "@/server/validation/clients";
import { taskFormSchema } from "@/server/validation/tasks";

export type TaskFormState = {
  status: "idle" | "error";
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

const GENERIC_ERROR = "Something went wrong on our side. Please try again.";
/** Task management is an owner/admin operation; members read only. */
const MANAGEMENT_ROLES = ["owner", "admin"] as const;

function readString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/**
 * Owner/admin gate. requireRole throws on insufficient role; that is mapped
 * to a safe message here, while unauthenticated still redirects to /login.
 */
async function requireTaskManager(): Promise<AuthContext | TaskFormState> {
  try {
    return await requireRole(...MANAGEMENT_ROLES);
  } catch (error) {
    if (isAppError(error)) {
      return {
        status: "error",
        formError: "You don't have permission to manage tasks.",
      };
    }
    throw error; // redirects / unexpected errors propagate
  }
}

function parseTaskForm(formData: FormData) {
  return taskFormSchema.safeParse({
    projectId: readString(formData.get("projectId")),
    title: readString(formData.get("title")),
    assigneeId: readString(formData.get("assigneeId")),
    status: readString(formData.get("status")) || "todo",
    priority: readString(formData.get("priority")) || "medium",
    dueDate: readString(formData.get("dueDate")),
  });
}

/**
 * Maps a tenant-relation failure onto the field that caused it, using neutral
 * wording that never reveals whether the row exists in another organization.
 */
function relationErrorState(message: string): TaskFormState {
  if (message.startsWith("Assignee")) {
    return { status: "error", fieldErrors: { assigneeId: ["Assignee not found."] } };
  }
  return { status: "error", fieldErrors: { projectId: ["Project not found."] } };
}

export async function createTaskAction(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const parsed = parseTaskForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error) };
  }

  const ctx = await requireTaskManager();
  if ("status" in ctx) return ctx;

  let projectId: string;
  try {
    const created = await taskData.createTask(ctx, parsed.data);
    projectId = created.projectId;
  } catch (error) {
    if (isAppError(error)) return relationErrorState(error.message);
    console.error("[tasks] create failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  revalidatePath("/tasks");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  redirect("/tasks?notice=created");
}

export async function updateTaskAction(
  taskId: string,
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  // The id is bound server-side from the URL; still validated before use.
  const id = z.uuid().safeParse(taskId);
  if (!id.success) {
    return { status: "error", formError: "Task not found." };
  }

  const parsed = parseTaskForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error) };
  }

  const ctx = await requireTaskManager();
  if ("status" in ctx) return ctx;

  try {
    const updated = await taskData.updateTask(ctx, id.data, parsed.data);
    if (!updated) {
      // Cross-tenant or deleted ids read as "not found" — never "forbidden".
      return { status: "error", formError: "Task not found." };
    }
  } catch (error) {
    if (isAppError(error)) return relationErrorState(error.message);
    console.error("[tasks] update failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  revalidatePath("/tasks");
  revalidatePath("/projects");
  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath("/dashboard");
  redirect(`/tasks/${id.data}?notice=updated`);
}

export async function deleteTaskAction(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const id = z.uuid().safeParse(readString(formData.get("taskId")));
  if (!id.success) {
    return { status: "error", formError: "Task not found." };
  }

  const ctx = await requireTaskManager();
  if ("status" in ctx) return ctx;

  try {
    // A foreign or already-deleted id simply removes nothing; the resulting
    // list state is identical either way, so no existence is leaked.
    await taskData.deleteTask(ctx, id.data);
  } catch (error) {
    console.error("[tasks] delete failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  revalidatePath("/tasks");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect("/tasks?notice=deleted");
}
