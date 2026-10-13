import { z } from "zod";

/**
 * Organization Settings input contracts. The server is the sole authority;
 * organization identity comes from authenticated context, never from the form.
 */
export const organizationSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Organization name is required.")
    .max(100, "Organization name is too long."),
});

export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;
