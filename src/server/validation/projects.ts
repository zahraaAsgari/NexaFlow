import { z } from "zod";

/**
 * Projects input contracts. Only fields the projects table actually has are
 * validated — clientId, name, description, status. The server is the sole
 * authority; client-side validation is never trusted, and the submitted
 * clientId is re-verified against the active tenant in the data layer.
 */

export const PROJECT_STATUSES = ["active", "completed", "archived"] as const;

export const projectFormSchema = z.object({
  clientId: z.uuid("Select a client."),
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(120, "Name is too long."),
  description: z
    .string()
    .trim()
    .max(2000, "Description is too long.")
    .transform((value) => (value === "" ? null : value)),
  status: z.enum(PROJECT_STATUSES),
});

export type ProjectFormInput = z.infer<typeof projectFormSchema>;

/** Route/identifier parameters — validated before any database access. */
export const projectParamsSchema = z.object({
  id: z.uuid("Invalid project."),
});

/** Projects list query string; only a filter, never an authorization input. */
export const projectsSearchParamsSchema = z.object({
  q: z.string().trim().max(100).catch("").default(""),
  page: z.coerce.number().int().min(1).max(1_000_000).catch(1).default(1),
});
