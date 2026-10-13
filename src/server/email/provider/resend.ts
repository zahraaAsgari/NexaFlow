import "server-only";

import { Resend } from "resend";

import { getEmailConfig } from "../config";
import type { EmailMessage, EmailProvider, SendEmailSuccess } from "../types";

/**
 * Provider adapter for Resend. The ONLY module in the application that
 * imports the provider SDK. Business code never does.
 *
 * Construction is lazy inside send() (via the factory) so a missing API key
 * does not bring the route down at import time.
 */

function toPlainText(html: string): string {
  // Minimal, deterministic text alternative. No provider coupling; strips
  // tags, decodes the most common entity, and collapses excess whitespace.
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  async send(message: EmailMessage): Promise<SendEmailSuccess> {
    const config = getEmailConfig();
    const resend = new Resend(config.resendApiKey);

    const { data, error } = await resend.emails.send({
      to: message.to,
      from: message.from ?? config.emailFrom,
      subject: message.subject,
      html: message.html,
      text:
        message.text !== undefined
          ? message.text
          : toPlainText(message.html),
      replyTo: message.replyTo,
    });

    if (error) {
      // Throw so the service can map it to a typed internal failure without
      // leaking provider details to the browser.
      throw Object.assign(new Error(error.message ?? "Email send failed"), {
        providerStatus:
          typeof (error as { statusCode?: unknown }).statusCode === "number"
            ? (error as { statusCode: number }).statusCode
            : null,
      });
    }

    return { ok: true, messageId: data?.id ?? null };
  }
}

export function createResendProvider(): EmailProvider {
  return new ResendEmailProvider();
}
