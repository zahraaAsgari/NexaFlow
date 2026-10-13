# Email Infrastructure

Foundational, provider-agnostic email transport for NexaFlow.

## What this is

`src/server/email/` is the single, server-only path for sending transactional
email. Business code (invitations, password reset, email verification, etc.)
builds a plain `EmailMessage` and calls `sendEmail()` from
`src/server/email/index.ts`. It never imports a provider SDK, never queries
the database, and never handles secrets — all of that lives inside this
directory.

```text
Feature code (server actions / data)
        ↓ email message (to, from, subject, html, text?, replyTo?)
src/server/email/index.ts  ──── server-only abstraction + validation + safe errors
        ↓
src/server/email/provider/resend.ts  ──── provider adapter (only place with the SDK)
        ↓
Resend (https://resend.com)
```

## Provider

Resend (`resend` npm package, official SDK). Chosen because it is a minimal,
single-package transactional-email provider that runs in this Node runtime and
keeps API keys entirely server-side. Swapping providers later means writing
another class implementing `EmailProvider` in
`src/server/email/provider/` and updating the one factory call in
`src/server/email/index.ts` — no business code changes.

## Required environment variables (names only — never values)

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Communicates with Resend. Server-side only. |
| `EMAIL_FROM` | Verified sender address (must be verified in the Resend dashboard). |
| `APP_URL` | Canonical public URL used to build secure links inside emails. Must be `https://` in production; `http://localhost:3000` is allowed for local development only. |

`dotenv` loads them from `.env` automatically (already a dependency for
`DATABASE_URL`). The application **boots fine without them** — email config is
validated **lazily at first send**, so developing other features without email
set up never breaks unrelated routes. A missing or malformed config produce an
actionable server-side error only when `sendEmail()` is actually called.

## How business code should use it (future)

```ts
import { sendEmail } from "@/server/email"; // server-only

const result = await sendEmail({
  to: user.email,
  subject: "You're invited to join Acme",
  html: `<p>...</p>`,
  text: "...",                     // optional plain-text fallback
  // from, replyTo are optional — from defaults to EMAIL_FROM
});

if (!result.ok) {
  // result.reason === "configuration" | "provider" | "invalid_input"
  // → map to a safe user-facing message in the action; never expose internals.
}
```

## What is intentionally NOT done

- No password reset / email verification / change-email-verification flows
- No notification system or email templates UI
- No queue, worker, retries, or rate limiting
- No database table for email messages
- No change to invitations (the single-copy raw-link display remains), auth, sessions, dashboard, account, or settings
- No provider-coupled business logic outside `src/server/email/`

## Logging policy

Logs emit only provider name, outcome, a provider message ID (server-side
diagnostic), and a non-reversible 8-char marker of the configured API key
(`describeEmailConfigMarker()`) so operators can confirm staging and
production use the same key without ever printing it. Recipients, subjects,
bodies, tokens and full addresses are never logged.
