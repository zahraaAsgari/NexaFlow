import "server-only";

import type { EmailMessage } from "../types";
import { getAppUrl } from "../config";

/**
 * Invitation email message. Sole responsibility: build a well-formed
 * EmailMessage from the invitation's own data. It has zero provider or
 * database awareness and contains NO secret besides the public acceptance
 * link formed from the raw token — never the stored hash, never the body in
 * logs.
 */

export type BuildInvitationEmailInput = {
  /** Recipient (validated + normalized by the invitation flow). */
  to: string;
  /** Trusted organization name from server context. */
  organizationName: string;
  /** Inviter display name/email from server context (never browser-supplied). */
  inviterName: string;
  /** Raw invitation token returned once by the persisted invitation. */
  rawToken: string;
  /** Trusted expiry timestamp from the persisted invitation. */
  expiresAt: Date;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function invitationUrl(rawToken: string): string {
  const base = getAppUrl().replace(/\/$/, "");
  return `${base}/invite/${encodeURIComponent(rawToken)}`;
}

function subject(organizationName: string): string {
  return `You're invited to join ${escapeHtml(organizationName)} on NexaFlow`;
}

function buildHtml(input: BuildInvitationEmailInput): string {
  const url = invitationUrl(input.rawToken);
  const organizationName = escapeHtml(input.organizationName);
  const inviterName = escapeHtml(input.inviterName);
  const expiry = formatDate(input.expiresAt);

  return `<!doctype html>
<html lang="en" dir="ltr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
        <tr><td style="padding:32px 28px 28px 28px;text-align:center;">
          <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f46e5;">NexaFlow</p>
          <h1 style="margin:0;font-size:22px;line-height:1.25;color:#0f172a;">You're invited to join ${organizationName}</h1>
          <p style="margin:14px 0 0 0;font-size:14px;line-height:1.5;color:#475569;">
            ${inviterName} invited you to collaborate in ${organizationName} on NexaFlow, the AI-powered business operations workspace.
          </p>
          <div style="margin:26px 0 0 0;">
            <a href="${url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">Accept invitation</a>
          </div>
          <p style="margin:22px 0 0 0;font-size:13px;line-height:1.5;color:#64748b;">
            Or open this link directly:<br>
            <a href="${url}" style="color:#4f46e5;word-break:break-all;">${url}</a>
          </p>
          <p style="margin:16px 0 0 0;font-size:12px;color:#94a3b8;">
            This invitation expires on ${escapeHtml(expiry)} and can be used only once. If you weren't expecting it, you can ignore this message.
          </p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0 0;font-size:11px;color:#94a3b8;text-align:center;">
        NexaFlow · AI-powered business operations workspace
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildText(input: BuildInvitationEmailInput): string {
  const url = invitationUrl(input.rawToken);
  const expiry = formatDate(input.expiresAt);
  return [
    `${input.inviterName} invited you to join ${input.organizationName} on NexaFlow.`,
    "",
    `Accept the invitation: ${url}`,
    "",
    `This link expires on ${expiry} and can be used once. If you weren't expecting it, you can ignore this message.`,
  ].join("\n");
}

/**
 * Builds the invitation EmailMessage. Uses APP_URL for the public link
 * (never the stored token hash, never logged). Deterministic output so the
 * same input always yields the same message.
 */
export function buildInvitationEmail(
  input: BuildInvitationEmailInput,
): EmailMessage {
  return {
    to: input.to,
    subject: subject(input.organizationName),
    html: buildHtml(input),
    text: buildText(input),
  };
}
