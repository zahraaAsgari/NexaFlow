import "server-only";

import { getEmailConfig } from "./config";
import { createResendProvider } from "./provider/resend";
import type { EmailMessage, SendEmailResult, EmailServiceError } from "./types";

/**
 * Email transport service.
 *
 * Business code (future invitations, password-reset, verification, etc.)
 * calls sendEmail(...) with a plain EmailMessage. It never imports a provider
 * SDK, never talks to the database, and never logs sensitive values. The
 * dependency on a provider is a single factory call here, so provider swap =
 * change one line, nothing else in the codebase.
 */

const provider = createResendProvider();

/** Minimal well-formedness checks before handing a message to the provider. */
function assertMessageWellFormed(message: EmailMessage): void {
  const basic = /^[^\s<>]+@[^\s<>]+\.[^\s<>]+$/;

  if (!message.to || !basic.test(message.to)) {
    throw InvalidInput(
      "EmailMessage `to` must be a valid, non-empty email address.",
    );
  }
  if (message.from !== undefined && !basic.test(message.from)) {
    throw InvalidInput(
      "EmailMessage `from` must be a valid email address when supplied.",
    );
  }
  if (message.replyTo !== undefined && !basic.test(message.replyTo)) {
    throw InvalidInput(
      "EmailMessage `replyTo` must be a valid email address when supplied.",
    );
  }
  if (!message.subject || message.subject.trim().length === 0) {
    throw InvalidInput("EmailMessage `subject` must be non-empty.");
  }
  if (message.subject.length > 200) {
    throw InvalidInput("EmailMessage `subject` is too long.");
  }
  if (!message.html || message.html.trim().length === 0) {
    throw InvalidInput("EmailMessage `html` must be non-empty (the body).");
  }
}

function InvalidInput(message: string): EmailServiceError {
  return { kind: "invalid_input", message };
}

function isServiceErrorShape(value: unknown): value is EmailServiceError {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    ((value as EmailServiceError).kind === "configuration" ||
      (value as EmailServiceError).kind === "provider" ||
      (value as EmailServiceError).kind === "invalid_input")
  );
}

function classifySendError(error: unknown): EmailServiceError {
  // Well-typed service errors fired by our own validation/config paths keep
  // their intended bucket — they are application-level signals, not provider
  // internals.
  if (isServiceErrorShape(error)) return error;

  // Configuration failure surfaces first (AppError with code "internal" thrown
  // by getEmailConfig when env lines are absent or malformed).
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "internal"
  ) {
    return {
      kind: "configuration",
      message: error instanceof Error ? error.message : "Email is not configured.",
    };
  }

  if (error instanceof Error) {
    const maybeStatus = (error as unknown as { providerStatus?: unknown })
      .providerStatus;
    const providerStatus =
      typeof maybeStatus === "number" ? maybeStatus : null;
    return { kind: "provider", status: providerStatus, message: error.message };
  }

  return { kind: "provider", status: null, message: "Email send failed." };
}

/**
 * Sends a well-formed email through the configured provider.
 *
 * Return shape is `SendEmailResult` (never throws to application code unless a
 * genuine bug); callers can distinguish configuration from provider-vs-input
 * failure to decide the right user-facing message. All sensitive values
 * (API key, email bodies, recipient PII) are confined to this server-only
 * module — never returned to the browser, never logged fully, never placed in
 * HTML.
 */
export async function sendEmail(
  message: EmailMessage,
): Promise<SendEmailResult> {
  // Lazy configuration validation happens exactly here, on first real send.
  try {
    getEmailConfig();
    assertMessageWellFormed(message);
  } catch (error) {
    const classified = classifySendError(error);
    return { ok: false, reason: classified.kind };
  }

  try {
    const success = await provider.send(message);
    // Operational signal WITHOUT exposing recipient, body, or secrets.
    console.info(
      `[email] provider=${provider.name} outcome=sent messageId=${success.messageId ?? "n/a"}`,
    );
    return success;
  } catch (error) {
    const classified = classifySendError(error);
    if (classified.kind === "provider") {
      console.error(
        `[email] provider=${provider.name} outcome=failed status=${classified.status ?? "n/a"} message=${classified.message}`,
      );
    }
    return { ok: false, reason: classified.kind };
  }
}

export { describeEmailConfigMarker, getAppUrl, getEmailConfig } from "./config";
export type {
  EmailMessage,
  SendEmailResult,
  EmailServiceError,
} from "./types";
