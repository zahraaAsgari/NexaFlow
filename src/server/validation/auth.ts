import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

/**
 * Shared authentication input contracts. The server is the sole authority;
 * these schemas parse untrusted action input as `unknown` and never trust
 * client-side validation.
 */
export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Your name is required.")
    .max(100, "Name is too long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.").max(254)),
  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    )
    .max(MAX_PASSWORD_LENGTH, "Password is too long."),
  organizationName: z
    .string()
    .trim()
    .min(1, "Organization name is required.")
    .max(100, "Organization name is too long."),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.").max(254)),
  password: z.string().min(1, "Password is required."),
});

export const switchOrganizationSchema = z.object({
  organizationId: z.uuid("Invalid organization."),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
