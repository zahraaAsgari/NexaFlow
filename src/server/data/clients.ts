import "server-only";

import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { clients } from "@/db/schema";
import type { AuthContext } from "@/server/auth";
import { ownedByOrg } from "./tenant";

/**
 * Client data access. These functions are the ONLY way features read or
 * mutate clients — and every one is locked to ctx.organization.id. The ctx
 * value is never taken from callers' untrusted input; call sites obtain it
 * from requireContext(). organizationId is never an authorization parameter.
 */

export type Client = typeof clients.$inferSelect;

/** Server-side page size for the clients list. Bounded; not user-controlled. */
export const CLIENTS_PAGE_SIZE = 25;

/**
 * Case-insensitive match across the client fields the schema actually has.
 * Values are parameterized by Drizzle (no raw SQL); ILIKE wildcards in the
 * term apply only inside the caller's own tenant.
 */
function clientSearchFilter(q: string | undefined): SQL | undefined {
  const term = q?.trim();
  if (!term) return undefined;
  const pattern = `%${term}%`;
  return or(
    ilike(clients.name, pattern),
    ilike(clients.email, pattern),
    ilike(clients.company, pattern),
  );
}

export async function getClientById(
  ctx: AuthContext,
  clientId: string,
): Promise<Client | null> {
  const rows = await db
    .select()
    .from(clients)
    .where(
      and(eq(clients.id, clientId), ownedByOrg(ctx, clients.organizationId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export type ListClientsOptions = {
  /** Optional case-insensitive search term applied inside the tenant only. */
  q?: string;
  limit: number;
  offset: number;
};

/** Tenant-scoped, server-side search and pagination for the clients list. */
export async function listClients(
  ctx: AuthContext,
  options: ListClientsOptions,
): Promise<Client[]> {
  return db
    .select()
    .from(clients)
    .where(
      and(ownedByOrg(ctx, clients.organizationId), clientSearchFilter(options.q)),
    )
    .orderBy(asc(clients.name))
    .limit(options.limit)
    .offset(options.offset);
}

export type ClientInput = {
  name: string;
  email: string | null;
  company: string | null;
};

export async function createClient(
  ctx: AuthContext,
  input: ClientInput,
): Promise<Client> {
  const [row] = await db
    .insert(clients)
    .values({
      name: input.name,
      email: input.email,
      company: input.company,
      // Tenant is ALWAYS the authenticated context — never input.
      organizationId: ctx.organization.id,
    })
    .returning();
  return row;
}

export type UpdateClientInput = ClientInput & {
  status: "active" | "archived";
};

/** Updates a client only if it belongs to the active org. null if not. */
export async function updateClient(
  ctx: AuthContext,
  clientId: string,
  input: UpdateClientInput,
): Promise<Client | null> {
  const rows = await db
    .update(clients)
    .set({
      name: input.name,
      email: input.email,
      company: input.company,
      status: input.status,
      updatedAt: new Date(),
    })
    .where(
      and(eq(clients.id, clientId), ownedByOrg(ctx, clients.organizationId)),
    )
    .returning();
  return rows[0] ?? null;
}

/** Deletes a client only if it belongs to the active org. true if removed. */
export async function deleteClient(
  ctx: AuthContext,
  clientId: string,
): Promise<boolean> {
  const rows = await db
    .delete(clients)
    .where(
      and(eq(clients.id, clientId), ownedByOrg(ctx, clients.organizationId)),
    )
    .returning({ id: clients.id });
  return rows.length > 0;
}

/**
 * Number of clients in the active organization, optionally matched by the
 * same tenant-scoped search filter as listClients.
 */
export async function countClients(
  ctx: AuthContext,
  q?: string,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(clients)
    .where(and(ownedByOrg(ctx, clients.organizationId), clientSearchFilter(q)));
  return rows[0]?.value ?? 0;
}
