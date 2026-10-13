import { z } from "zod";

import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/server/validation/auth";

/**
 * Account/Profile input contracts. The server is the sole authority; the
 * authenticated user comes from the trusted auth context, never the form.
 */

export const accountProfileSchema = z.object({
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
});

/** Name-only variant for the profile mutation (email changes go through the
 *  verified change-email flow instead). */
export const accountProfileNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Your name is required.")
    .max(100, "Name is too long."),
});

export type AccountProfileInput = z.infer<typeof accountProfileSchema>;

/**
 * New password follows the exact same policy as signup (shared constants so
 * the two can never drift). Confirmation must match; current password acts as
 * the second factor before the change is trusted.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      )
      .max(MAX_PASSWORD_LENGTH, "Password is too long."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
