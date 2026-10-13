import "server-only";

import type { EmailMessage } from "../types";
import { getAppUrl } from "../config";

/** Email-verification message. Link uses only the raw token; the DB holds a hash. */

export type BuildEmailVerificationEmailInput = {
  to: string;
  rawToken: string;
  expiresAt: Date;
};

function verifyUrl(rawToken: string): string {
  const base = getAppUrl().replace(/\/$/, "");
  return `${base}/verify-email/${encodeURIComponent(rawToken)}`;
}

export function buildEmailVerificationEmail(
  input: BuildEmailVerificationEmailInput,
): EmailMessage {
  const url = verifyUrl(input.rawToken);
  const expiry = input.expiresAt.toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html = `<!doctype html>
<html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
      <tr><td style="padding:32px 28px 28px 28px;text-align:center;">
        <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f46e5;">NexaFlow</p>
        <h1 style="margin:0;font-size:22px;line-height:1.25;color:#0f172a;">Verify your email address</h1>
        <p style="margin:14px 0 0 0;font-size:14px;line-height:1.5;color:#475569;">
          Welcome to NexaFlow. Confirm that this email address belongs to you to finish setting up your account.
        </p>
        <div style="margin:26px 0 0 0;">
          <a href="${url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">Verify email address</a>
        </div>
        <p style="margin:22px 0 0 0;font-size:13px;line-height:1.5;color:#64748b;">
          Or open this link directly:<br>
          <a href="${url}" style="color:#4f46e5;word-break:break-all;">${url}</a>
        </p>
        <p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">
          This link expires on ${expiry} and can be used once. If you didn't sign up for NexaFlow, you can ignore this message.
        </p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0 0;font-size:11px;color:#94a3b8;text-align:center;">NexaFlow · AI-powered business operations workspace</p>
  </td></tr></table>
</body></html>`;

  const text = [
    `Welcome to NexaFlow. Confirm that this email address belongs to you to finish setting up your account.`,
    "",
    `Verify your email address: ${url}`,
    "",
    `This link expires on ${expiry} and can be used once. If you didn't sign up for NexaFlow, you can ignore this message.`,
  ].join("\n");

  return { to: input.to, subject: "Verify your NexaFlow email address", html, text };
}
