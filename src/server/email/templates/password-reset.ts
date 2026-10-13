import "server-only";

import type { EmailMessage } from "../types";
import { getAppUrl } from "../config";

/** Password-reset message. Link uses only the raw token; the DB holds a hash. */

export type BuildPasswordResetEmailInput = {
  to: string;
  rawToken: string;
  expiresAt: Date;
};

function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function resetUrl(rawToken: string): string {
  const base = getAppUrl().replace(/\/$/, "");
  return `${base}/reset-password/${encodeURIComponent(rawToken)}`;
}

export function buildPasswordResetEmail(
  input: BuildPasswordResetEmailInput,
): EmailMessage {
  const url = resetUrl(input.rawToken);
  const expiry = input.expiresAt.toLocaleTimeString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const html = `<!doctype html>
<html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
      <tr><td style="padding:32px 28px 28px 28px;text-align:center;">
        <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f46e5;">NexaFlow</p>
        <h1 style="margin:0;font-size:22px;line-height:1.25;color:#0f172a;">Reset your password</h1>
        <p style="margin:14px 0 0 0;font-size:14px;line-height:1.5;color:#475569;">
          We received a request to reset the password for this NexaFlow account. Choose a new password below.
        </p>
        <div style="margin:26px 0 0 0;">
          <a href="${url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">Choose a new password</a>
        </div>
        <p style="margin:22px 0 0 0;font-size:13px;line-height:1.5;color:#64748b;">
          Or open this link directly:<br>
          <a href="${url}" style="color:#4f46e5;word-break:break-all;">${url}</a>
        </p>
        <p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">
          This link is valid for one hour and can be used once. If you didn't request a password reset, you can safely ignore this email — your current password stays unchanged.
        </p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0 0;font-size:11px;color:#94a3b8;text-align:center;">NexaFlow · AI-powered business operations workspace</p>
  </td></tr></table>
</body></html>`;

  const text = [
    `We received a request to reset the password for this NexaFlow account.`,
    "",
    `Choose a new password: ${url}`,
    "",
    `This link is valid for one hour and can be used once. If you didn't request a password reset, you can ignore this email — your current password stays unchanged.`,
  ].join("\n");

  void escapeHtml; // referenced by template parity (no dynamic data beyond the URL)

  return { to: input.to, subject: "Reset your NexaFlow password", html, text };
}
