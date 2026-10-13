import "server-only";

import { eq, and, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { AuthContext } from "@/server/auth";

/**
 * DATA-LAYER TENANT CONTRACT
 * ==========================
 * The single invariant of NexaFlow: a user may only ever read or mutate rows
 * whose `organization_id` equals their *authenticated, server-resolved* active
 * organization. That value lives on `AuthContext.organization.id` and can ONLY
 * originate from `requireContext()` / `requireAuth()` — never from a form,
 * URL, search param, hidden field, cookie, or request body.
 *
 * To make tenant scoping structural (impossible to forget):
 *
 *  1. Every function in src/server/data takes `ctx: AuthContext` as its FIRST
 *     argument and derives the org id itself. Callers CANNOT supply an org id.
 *  2. Read/update/delete use `ownedByOrg(ctx, table.organizationId)` so the
 *     tenant predicate and the resource predicate are always ANDed together —
 *     "not found" is returned for cross-tenant IDs (never "forbidden"),
 *     which also avoids leaking that a resource exists in another tenant.
 *  3. All INSERTs set `organizationId: ctx.organization.id` from context; the
 *     value is never accepted from input.
 *
 * The composite foreign keys in the schema are a second, database-level wall
 * behind these application-layer checks for cross-entity relationships.
 */

/**
 * Builds ` AND organization_id = ctx.organization.id ` as a composable
 * predicate. Combine with a resource predicate via `and(...)`.
 */
export function ownedByOrg(ctx: AuthContext, orgColumn: AnyPgColumn): SQL {
  return eq(orgColumn, ctx.organization.id);
}

/**
 * Narrows a context to rows the caller may act on. Present so every data
 * module can make the boundary explicit and so future helpers (e.g. role
 * gates layered on the data layer) have one canonical entry point. Today it
 * simply returns the trusted organization id from server context — which is
 * precisely the point: there is no other legitimate source.
 */
export function requireOrganizationContext(ctx: AuthContext): string {
  return ctx.organization.id;
}
