"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import * as clientData from "@/server/data/clients";
import { isAppError } from "@/server/errors";
import { requireRole, type AuthContext } from "@/server/auth";
import {
  clientFormSchema,
  issuesToFieldErrors,
} from "@/server/validation/clients";

export type ClientFormState = {
  status: "idle" | "error";
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

const GENERIC_ERROR =
  "Something went wrong on our side. Please try again.";
/** Client management is an owner/admin operation; members read only. */
const MANAGEMENT_ROLES = ["owner", "admin"] as const;

function readString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/**
 * Owner/admin gate. Never influences WHAT is returned — only whether the
 * mutation runs. requireRole throws on insufficient role; mapped to a safe
 * message here while unauthenticated still redirects to /login.
 */
async function requireClientManager(): Promise<AuthContext | ClientFormState> {
  try {
    return await requireRole(...MANAGEMENT_ROLES);
  } catch (error) {
    if (isAppError(error)) {
      return {
        status: "error",
        formError: "You don't have permission to manage clients.",
      };
    }
    throw error; // redirects / unexpected errors propagate
  }
}

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const parsed = clientFormSchema.safeParse({
    name: readString(formData.get("name")),
    email: readString(formData.get("email")),
    company: readString(formData.get("company")),
    status: "active",
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error) };
  }

  const ctx = await requireClientManager();
  if ("status" in ctx) return ctx;

  try {
    await clientData.createClient(ctx, {
      name: parsed.data.name,
      email: parsed.data.email,
      company: parsed.data.company,
    });
  } catch (error) {
    console.error("[clients] create failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  revalidatePath("/clients");
  redirect("/clients?notice=created");
}

export async function updateClientAction(
  clientId: string,
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  // The id is bound server-side from the URL; still validated before use.
  const id = z.uuid().safeParse(clientId);
  if (!id.success) {
    return { status: "error", formError: "Client not found." };
  }

  const parsed = clientFormSchema.safeParse({
    name: readString(formData.get("name")),
    email: readString(formData.get("email")),
    company: readString(formData.get("company")),
    status: readString(formData.get("status")),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error) };
  }

  const ctx = await requireClientManager();
  if ("status" in ctx) return ctx;

  try {
    const updated = await clientData.updateClient(ctx, clientId, parsed.data);
    if (!updated) {
      // Cross-tenant or deleted ids read as "not found" — never "forbidden".
      return { status: "error", formError: "Client not found." };
    }
  } catch (error) {
    if (isAppError(error)) {
      return { status: "error", formError: "Client not found." };
    }
    console.error("[clients] update failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  revalidatePath("/clients");
  redirect(`/clients/${clientId}?notice=updated`);
}

export async function deleteClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const id = z.uuid().safeParse(readString(formData.get("clientId")));
  if (!id.success) {
    return { status: "error", formError: "Client not found." };
  }

  const ctx = await requireClientManager();
  if ("status" in ctx) return ctx;

  try {
    const deleted = await clientData.deleteClient(ctx, id.data);
    // A foreign or already-deleted id is not an error worth surfacing — the
    // goal list state is identical either way, and no existence is leaked.
    if (!deleted) {
      revalidatePath("/clients");
      redirect("/clients");
    }
  } catch (error) {
    console.error("[clients] delete failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  revalidatePath("/clients");
  redirect("/clients?notice=deleted");
}
