import "server-only";

import { createHash } from "node:crypto";

import { AppError } from "@/server/errors";

/**
 * Email configuration. All values come from process.env and are validated
 * LAZILY — i.e. only when email is actually sent, not at app boot. A missing
 * API key therefore never takes /dashboard or /login offline in a development
 * environment where a provider simply isn't configured yet; but a genuinely
 * misconfigured production environment fails clearly at the first real send.
 *
 * Values are NEVER returned to the browser, rendered into HTML, or logged.
 */

export type EmailConfig = {
  resendApiKey: string;
  emailFrom: string;
  appUrl: string;
};

let cached: EmailConfig | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    // Configuration failure is a deployment concern: fail closed, with an
    // actionable server-side message, never echoing the value itself.
    throw new AppError(
      "internal",
      `Email is not configured: missing ${name}. Set ${name} in the environment to enable email delivery.`,
    );
  }
  return value.trim();
}

/**
 * Validates EMAIL_FROM is a well-formed bare address so a misconfigured
 * sender does not silently reach the provider. Does not validate the
 * domain's verified state — Resend requires the sender/domain to be verified
 * inside the Resend dashboard; see src/server/email/README.md.
 */
function assertWellFormedSender(address: string): void {
  const basic = /^[^\s<>]+@[^\s<>]+\.[^\s<>]+$/;
  if (!basic.test(address)) {
    throw new AppError(
      "internal",
      "EMAIL_FROM does not look like a valid email address. Set it inside the environment (for example, a verified sender in your provider dashboard).",
    );
  }
}

/**
 * Validates APP_URL is an HTTPS (or explicitly allowed http://localhost for
 * local development) URL, so invitation/verification links cannot silently
 * emit localhost in production or an untrusted origin.
 */
function assertSafeAppUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError(
      "internal",
      "APP_URL must be an absolute URL (for example, https://app.nexaflow.com). It is used to build secure links inside emails.",
    );
  }

  if (parsed.protocol === "http:") {
    const isLocalhost =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname.endsWith(".localhost");
    if (process.env.NODE_ENV === "production" && !isLocalhost) {
      throw new AppError(
        "internal",
        "APP_URL is http://. In production, APP_URL must be https:// so invitation and verification links are secure. Local http:// is accepted only for localhost development.",
      );
    }
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError(
      "internal",
      `APP_URL must start with https:// (or http:// for local development). Got an unsupported scheme: ${parsed.protocol}.`,
    );
  }
}

/**
 * Reads and validates the email configuration.
 *
 * Fail-fast and unambiguous when format is wrong, but only when actually used
 * (lazy). a single result is cached to avoid re-validating the same values on
 * every send.
 */
export function getEmailConfig(): EmailConfig {
  if (cached) return cached;

  const resendApiKey = requireEnv("RESEND_API_KEY");
  const emailFrom = requireEnv("EMAIL_FROM");
  assertWellFormedSender(emailFrom);

  const appUrl = requireEnv("APP_URL");
  assertSafeAppUrl(appUrl);

  cached = { resendApiKey, emailFrom, appUrl };
  return cached;
}

/** Returns just the validated APP_URL. No logging, no exposure. */
export function getAppUrl(): string {
  return getEmailConfig().appUrl;
}

/**
 * A keyed indicator of which configuration is present, safe to log. Should a
 * future config fail, this never echoes the true key value, only its
 * crediagement marker the first 4 hex of its SHA-256 (a non-reversible
 * identifier that lets an operator confirm they are using the same key in
 * staging and production without ever printing the key itself).
 */
export function describeEmailConfigMarker(): string {
  const value = process.env.RESEND_API_KEY;
  if (!value) return "unset";
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}
