import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import type { AuthContext } from "@/server/auth";
import { getPendingEmailChange, type PendingEmailChange } from "./email-change";

/**
 * Account page presentation model. Personal identity only — resolved for the
 * already-authenticated user, never from a URL param or form.
 */
export type AccountEmailState = {
  email: string;
  emailVerifiedAt: Date | null;
  pendingChange: PendingEmailChange | null;
};

export async function getAccountEmailState(
  ctx: AuthContext,
): Promise<AccountEmailState> {
  const [rows, pendingChange] = await Promise.all([
    db
      .select({
        email: users.email,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1),
    getPendingEmailChange(ctx.user.id),
  ]);

  const row = rows[0];
  return {
    email: row?.email ?? ctx.user.email,
    emailVerifiedAt: row?.emailVerifiedAt ?? null,
    pendingChange,
  };
}
