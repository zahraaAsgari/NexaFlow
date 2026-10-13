import "server-only";

/**
 * Provider-independent email types.
 *
 * These types deliberately describe ONLY the transport concern — they know
 * nothing about invitations, users, organizations, reset tokens or any other
 * business concept. Future features build a message in feature code and hand
 * it to the transport; the transport never queries business data.
 */

export type EmailMessage = {
  to: string;
  /** Configured sender identity (see EMAIL_FROM env). */
  from?: string;
  subject: string;
  html: string;
  /** Optional plain-text alternative when the HTML is the primary body. */
  text?: string;
  replyTo?: string;
};

/**
 * Discriminator between failures that must be handled differently by callers
 * (config = fix the deployment, provider = transient/external issue, input =
 * fix the caller's message). All three map to AppError codes at the boundary;
 * the raw provider response is never surfaced to the browser.
 */
export type EmailServiceError =
  | { kind: "configuration"; message: string }
  | { kind: "provider"; status: number | null; message: string }
  | { kind: "invalid_input"; message: string };

export type SendEmailSuccess = {
  ok: true;
  /** Provider-supplied identifier, safe to retain in server logs only. */
  messageId: string | null;
};

export type SendEmailResult =
  | SendEmailSuccess
  | { ok: false; reason: "configuration" | "provider" | "invalid_input" };

/**
 * The contract the rest of the application depends on. Business code calls
 * `sendEmail`; it never imports a provider SDK, so ProviderX can swap for
 * ProviderY by changing only the adapter's construction in the factory.
 */
export type EmailProvider = {
  readonly name: string;
  send(message: EmailMessage): Promise<SendEmailSuccess>;
};
