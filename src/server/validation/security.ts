import { z } from "zod";

import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/server/validation/auth";

/**
 * Account email security input contracts. The server is the sole authority.
 */

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.").max(254)),
});

/** New password follows the exact same policy as signup (shared constants). */
export const resetPasswordSchema = z
  .object({
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

export const requestEmailChangeSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.").max(254)),
});

/** Raw security token supplied through a public verification URL. */
export const securityTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{20,128}$/, "Invalid link.");
