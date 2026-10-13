import {
  date,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * NexaFlow database foundation.
 *
 * Tenancy model:
 *   users ──< memberships >── organizations
 *   sessions ──> memberships (user_id + active_organization_id)
 *   organizations ──< clients ──< projects ──< tasks
 *
 * Tenant-owned tables (clients, projects, tasks) always carry a NOT NULL
 * organization_id. Cross-entity relationships use composite foreign keys that
 * include organization_id, so a record can never reference a parent (or an
 * assignee's membership) owned by a different tenant at the database level.
 */

/* ---------------------------------- enums --------------------------------- */

export const organizationRoleEnum = pgEnum("organization_role", [
  "owner",
  "admin",
  "member",
]);

export const clientStatusEnum = pgEnum("client_status", ["active", "archived"]);

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "completed",
  "archived",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "done",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
]);

/* ------------------------------ column helpers ---------------------------- */

const id = () => uuid("id").primaryKey().defaultRandom();

/**
 * Returns fresh column instances on every call — Drizzle column builders
 * cannot be shared across table definitions. No triggers: the application
 * layer sets updated_at explicitly on writes.
 */
const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------ global identity --------------------------- */

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    /** NULL = email not verified; timestamp when the address proves control.
     *  Set only by the email-verification and change-email-verification flows —
     *  never accepted from the client. */
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

/**
 * One-time credentials for account email recovery + verification. All three
 * store only sha2 token(String(rawToken}) — the raw token exists only long
 * enough to become URL-safe delivery material and is never logged.
 *
 * State is represented by timestamps (unused = used_at IS NULL and
 * expires_at > now()), not enums. Each flow invalidates/supersedes any
 * active credential for the same (user, purpose) before creating a new one.
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("password_reset_tokens_token_hash_unique").on(t.tokenHash),
    index("password_reset_tokens_user_id_idx").on(t.userId),
  ],
);

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("email_verification_tokens_token_hash_unique").on(t.tokenHash),
    index("email_verification_tokens_user_id_idx").on(t.userId),
  ],
);

/** Pending, as-yet-unverified request to switch the account email. */
export const emailChangeTokens = pgTable(
  "email_change_tokens",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    newEmail: text("new_email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("email_change_tokens_token_hash_unique").on(t.tokenHash),
    index("email_change_tokens_user_id_idx").on(t.userId),
  ],
);

export const organizations = pgTable(
  "organizations",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("organizations_slug_unique").on(t.slug)],
);

/* --------------------------------- tenancy -------------------------------- */

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: organizationRoleEnum("role").notNull(),
    ...timestamps(),
  },
  (t) => [
    index("memberships_user_id_idx").on(t.userId),
    index("memberships_organization_id_idx").on(t.organizationId),
    // Referenced key for tenant-safe composite FKs (sessions, tasks.assignee).
    unique("memberships_user_id_organization_id_unique").on(
      t.userId,
      t.organizationId,
    ),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activeOrganizationId: uuid("active_organization_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_unique").on(t.tokenHash),
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_expires_at_idx").on(t.expiresAt),
    // A session may only point at an organization the user actually belongs
    // to. Losing the membership (or the user/org) removes the session.
    foreignKey({
      name: "sessions_user_organization_memberships_fk",
      columns: [t.userId, t.activeOrganizationId],
      foreignColumns: [memberships.userId, memberships.organizationId],
    }).onDelete("cascade"),
  ],
);

/**
 * Pending invitations to join an organization.
 *
 * Security model mirrors sessions: the recipient's link carries a raw random
 * token; only SHA-256(token) is stored here, so a database read never yields a
 * usable invitation link. State is represented by timestamps rather than an
 * enum — pending = accepted_at IS NULL and expires_at > now(); accepted =
 * accepted_at set; revoked = row deleted. A partial unique index (added in the
 * migration) allows only ONE pending invitation per (organization, email).
 */
export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Normalized (trimmed + lowercased) exactly like auth email handling. */
    email: text("email").notNull(),
    /** Role granted on acceptance. Application restricts this to admin|member. */
    role: organizationRoleEnum("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    /** Who sent it; kept for display. Nulled if that user is deleted. */
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("invitations_token_hash_unique").on(t.tokenHash),
    index("invitations_organization_id_idx").on(t.organizationId),
    index("invitations_email_idx").on(t.email),
  ],
);

/* ---------------------------- tenant-owned data --------------------------- */

export const clients = pgTable(
  "clients",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    company: text("company"),
    status: clientStatusEnum("status").notNull().default("active"),
    ...timestamps(),
  },
  (t) => [
    index("clients_organization_id_idx").on(t.organizationId),
    // Referenced key for tenant-safe composite FKs targeting this table.
    unique("clients_id_organization_id_unique").on(t.id, t.organizationId),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: projectStatusEnum("status").notNull().default("active"),
    ...timestamps(),
  },
  (t) => [
    index("projects_organization_id_idx").on(t.organizationId),
    index("projects_client_id_idx").on(t.clientId),
    // A project can never reference a client owned by another tenant.
    foreignKey({
      name: "projects_client_organization_clients_fk",
      columns: [t.clientId, t.organizationId],
      foreignColumns: [clients.id, clients.organizationId],
    }).onDelete("cascade"),
    // Referenced key for tenant-safe composite FKs targeting this table.
    unique("projects_id_organization_id_unique").on(t.id, t.organizationId),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    assigneeId: uuid("assignee_id"),
    title: text("title").notNull(),
    status: taskStatusEnum("status").notNull().default("todo"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    dueDate: date("due_date"),
    ...timestamps(),
  },
  (t) => [
    index("tasks_organization_id_idx").on(t.organizationId),
    index("tasks_project_id_idx").on(t.projectId),
    index("tasks_assignee_id_idx").on(t.assigneeId),
    // A task can never reference a project owned by another tenant.
    foreignKey({
      name: "tasks_project_organization_projects_fk",
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete("cascade"),
    // Assignees must be members of the same organization. Declared as
    // "set null" and narrowed in the migration to the PostgreSQL 15 column
    // subset ON DELETE SET NULL (assignee_id): a plain composite SET NULL
    // would also null organization_id, which is NOT NULL. Drizzle's FK
    // builder cannot express the column subset, so the generated SQL is
    // edited there (documented in the migration header).
    foreignKey({
      name: "tasks_assignee_organization_memberships_fk",
      columns: [t.assigneeId, t.organizationId],
      foreignColumns: [memberships.userId, memberships.organizationId],
    }).onDelete("set null"),
  ],
);
