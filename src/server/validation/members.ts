import { z } from "zod";

import { organizationRoleEnum } from "@/db/schema";

/**
 * Team/Members input contracts. Role values are derived from the canonical
 * schema enum — not re-declared here — so they can never drift.
 */
export const ORGANIZATION_ROLES = organizationRoleEnum.enumValues;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const updateMemberRoleSchema = z.object({
  membershipId: z.uuid("Invalid member."),
  role: z.enum(ORGANIZATION_ROLES),
});

export const removeMemberSchema = z.object({
  membershipId: z.uuid("Invalid member."),
});

/** Team list query string; only a filter, never an authorization input. */
export const teamSearchParamsSchema = z.object({
  q: z.string().trim().max(100).catch("").default(""),
  page: z.coerce.number().int().min(1).max(1_000_000).catch(1).default(1),
});
