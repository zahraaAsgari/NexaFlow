"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import * as memberData from "@/server/data/members";
import { isAppError } from "@/server/errors";
import { requireRole, type AuthContext } from "@/server/auth";
import {
  removeMemberSchema,
  updateMemberRoleSchema,
} from "@/server/validation/members";

export type MemberActionState = {
  status: "idle" | "error";
  formError?: string;
};

const GENERIC_ERROR = "Something went wrong on our side. Please try again.";
const LAST_OWNER_ERROR =
  "You can't remove or demote the organization's only owner.";

function readString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/**
 * Owner-only gate. requireRole("owner") throws for non-owners; mapped to a
 * safe message here, while unauthenticated still redirects to /login.
 */
async function requireTeamOwner(): Promise<AuthContext | MemberActionState> {
  try {
    return await requireRole("owner");
  } catch (error) {
    if (isAppError(error)) {
      return {
        status: "error",
        formError: "Only the organization owner can manage members.",
      };
    }
    throw error; // redirects / unexpected errors propagate
  }
}

/**
 * Resolves the target membership within the active tenant. Returns a neutral
 * "not found" state for cross-tenant or deleted membership ids — never
 * "forbidden", so nothing about another organization's members is revealed.
 */
async function requireMemberInTenant(
  ctx: AuthContext,
  membershipId: string,
): Promise<memberData.OrganizationMember | MemberActionState> {
  const member = await memberData.getMemberById(ctx, membershipId);
  if (!member) {
    return { status: "error", formError: "Member not found." };
  }
  return member;
}

export async function updateMemberRoleAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const parsed = updateMemberRoleSchema.safeParse({
    membershipId: readString(formData.get("membershipId")),
    role: readString(formData.get("role")),
  });
  if (!parsed.success) {
    return { status: "error", formError: "Invalid role." };
  }

  const ctx = await requireTeamOwner();
  if ("status" in ctx) return ctx;

  const target = await requireMemberInTenant(ctx, parsed.data.membershipId);
  if ("status" in target) return target;

  // Owner role is fixed: the schema does not support safe ownership transfer,
  // and demoting the only owner would orphan the organization.
  if (target.role === "owner" && parsed.data.role !== "owner") {
    return { status: "error", formError: LAST_OWNER_ERROR };
  }

  // Guard: never leave the organization without an owner.
  if (target.role === "owner" || parsed.data.role === "owner") {
    const owners = await memberData.countOwners(ctx);
    if (target.role === "owner" && target.role !== parsed.data.role && owners <= 1) {
      return { status: "error", formError: LAST_OWNER_ERROR };
    }
  }

  // The organization always has exactly one owner under this model; assigning
  // a second owner is intentionally rejected.
  if (parsed.data.role === "owner" && target.role !== "owner") {
    return {
      status: "error",
      formError: "Ownership transfer isn't supported yet.",
    };
  }

  try {
    const updated = await memberData.updateMemberRole(
      ctx,
      parsed.data.membershipId,
      parsed.data.role,
    );
    if (!updated) return { status: "error", formError: "Member not found." };
  } catch (error) {
    console.error("[members] update role failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  revalidatePath("/team");
  return { status: "idle" };
}

export async function removeMemberAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const parsed = removeMemberSchema.safeParse({
    membershipId: readString(formData.get("membershipId")),
  });
  if (!parsed.success) {
    return { status: "error", formError: "Member not found." };
  }

  const ctx = await requireTeamOwner();
  if ("status" in ctx) return ctx;

  const target = await requireMemberInTenant(ctx, parsed.data.membershipId);
  if ("status" in target) return target;

  // An owner cannot remove themselves; with the single-owner model the owner
  // account is also structurally the last owner, which must not disappear.
  if (target.userId === ctx.user.id || target.role === "owner") {
    return { status: "error", formError: LAST_OWNER_ERROR };
  }

  try {
    await memberData.removeMember(ctx, parsed.data.membershipId);
  } catch (error) {
    console.error("[members] remove failed", error);
    return { status: "error", formError: GENERIC_ERROR };
  }

  revalidatePath("/team");
  revalidatePath("/tasks");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { status: "idle" };
}
