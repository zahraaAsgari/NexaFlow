# NexaFlow

**Multi-tenant business operations workspace for agencies and service teams.**

NexaFlow brings clients, projects, and tasks into a single shared workspace — built with Next.js 16, React 19, TypeScript, PostgreSQL, and Drizzle ORM.

## What it does

- **Client management** — track client relationships with contact details and company info
- **Project tracking** — organize projects under clients with status tracking
- **Task collaboration** — assign tasks, set priorities and due dates, track progress
- **Team workspace** — invite members by email with owner/admin/member roles
- **Real-time dashboard** — live counts of clients, projects, and tasks
- **Secure by design** — scrypt password hashing, protected sessions, strict organization isolation

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router, Server Components, Server Actions) |
| UI | React 19.2.6, Tailwind CSS 4, Sonner (toasts) |
| Language | TypeScript 5.9.3 (strict) |
| Database | PostgreSQL 15, Drizzle ORM 0.45.2 |
| Auth | First-party email/password, scrypt, opaque session tokens |
| Email | Resend (provider-agnostic adapter) |
| Testing | Vitest (66 tests, dedicated test database) |

## Quick start

```bash
npm install
cp .env.example .env    # fill in DATABASE_URL
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `APP_URL` | For email | Public HTTPS URL (for links in emails) |
| `RESEND_API_KEY` | For email | Resend API key |
| `EMAIL_FROM` | For email | Verified sender address |
| `TEST_DATABASE_URL` | For tests | Separate test database (must differ from `DATABASE_URL`) |

## Scripts

```bash
npm run dev          # development server
npm run build       # production build
npm run start       # production server
npm run test:run    # run test suite
npm run typecheck   # TypeScript check
npm run lint        # ESLint
npm run db:migrate  # apply migrations
./scripts/backup.sh       # create database backup
./scripts/restore-test.sh # verify backup/restore cycle
```

## Security

- Multi-tenant isolation enforced at the database level (composite foreign keys)
- All tenant-scoped queries filtered by `ownedByOrg(ctx, ...)`
- Rate limiting on login, signup, and forgot-password
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Session tokens stored as SHA-256 hashes — never in plaintext
- No secrets in client bundles

## Testing

```bash
npm run test:run
```

66 tests covering tenant isolation, authorization, password hashing, session invalidation, password reset, email verification, change-email security, invitation security, concurrency, rate limiting, and notification behavior.

## Project structure

```
src/
  app/           # routes (public, auth, app groups)
  components/    # UI components (app shell, clients, projects, tasks, team, notifications)
  db/            # schema + connection
  server/
    auth/        # authentication, sessions, context
    data/        # tenant-scoped data access layer
    actions/     # server actions
    email/       # provider-agnostic email + templates
    security/    # rate limiting, token utilities
    validation/  # zod schemas
scripts/         # backup, restore, restore-test
docs/            # deployment, backup security, restore test
```

## License

Private — not yet licensed for public use.
