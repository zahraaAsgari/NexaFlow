import { z } from "zod";

/**
 * Clients input contracts. Only fields the clients table actually has are
 * validated — name, email, company, status. The server is the sole authority;
 * client-side validation is never trusted.
 */

export const clientFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name is too long."),
  email: z
    .union([
      z.literal(""),
      z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.").max(254)),
    ])
    .transform((value) => (value === "" ? null : value)),
  company: z
    .string()
    .trim()
    .max(100, "Company name is too long.")
    .transform((value) => (value === "" ? null : value)),
  status: z.enum(["active", "archived"]),
});

export type ClientFormInput = z.infer<typeof clientFormSchema>;

/** Route/identifier parameters — validated before any database access. */
export const clientParamsSchema = z.object({
  id: z.uuid("Invalid client."),
});

/** Clients list query string; only a filter, never an authorization input. */
export const clientsSearchParamsSchema = z.object({
  q: z.string().trim().max(100).catch("").default(""),
  page: z.coerce.number().int().min(1).max(1_000_000).catch(1).default(1),
});

/**
 * Maps Zod issues to field-level errors for rendering, following the same
 * convention as the authentication actions.
 */
export function issuesToFieldErrors(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}
