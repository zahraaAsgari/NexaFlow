import Link from "next/link";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentAuth } from "@/server/auth";
import { getInvitationByToken } from "@/server/data/invitations";
import { invitationTokenSchema } from "@/server/validation/invitations";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icons";
import { AcceptAsCurrentUser, AcceptWithNewAccount } from "./accept-forms";

export const dynamic = "force-dynamic";

/** Invitation tokens are per-user secrets — never index. */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

type Params = Promise<{ token: string }>;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
            NexaFlow
          </p>
        </div>
        <Card className="p-8">{children}</Card>
      </div>
    </main>
  );
}

function InvalidState({ title, detail }: { title: string; detail: string }) {
  return (
    <Shell>
      <div className="text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400">
          <Icon name="close" className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{detail}</p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          Go to sign in
        </Link>
      </div>
    </Shell>
  );
}

/**
 * Invitation acceptance surface. Public by design (the recipient may have no
 * account), but it reveals nothing without a valid token, and every decision
 * — organization, role, identity match — is re-checked server-side in the
 * accept actions. The token is never echoed into visible copy.
 */
export default async function InvitePage({ params }: { params: Params }) {
  const raw = await params;
  const parsedToken = invitationTokenSchema.safeParse(raw.token);
  if (!parsedToken.success) {
    return (
      <InvalidState
        title="This invitation is no longer valid."
        detail="The link may be incomplete or already revoked."
      />
    );
  }

  const invitation = await getInvitationByToken(parsedToken.data);
  if (!invitation) {
    return (
      <InvalidState
        title="This invitation is no longer valid."
        detail="It may have been revoked, or the link is incorrect."
      />
    );
  }
  if (invitation.acceptedAt) {
    return (
      <InvalidState
        title="This invitation has already been used."
        detail="Sign in with the invited account to access the organization."
      />
    );
  }
  if (invitation.expiresAt <= new Date()) {
    return (
      <InvalidState
        title="This invitation has expired."
        detail="Ask the organization owner to send you a new one."
      />
    );
  }

  const auth = await getCurrentAuth();
  const roleLabel = ROLE_LABELS[invitation.role] ?? invitation.role;

  const header = (
    <div className="text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-indigo-50 text-indigo-600">
        <Icon name="users" className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-slate-900">
        You&apos;re invited to join {invitation.organizationName}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Join as{" "}
        <span className="font-medium text-slate-900">{roleLabel}</span> ·{" "}
        {invitation.email}
      </p>
    </div>
  );

  // Signed in with a DIFFERENT address — never let one account claim another's
  // invitation; the action enforces the same rule server-side.
  if (auth && auth.user.email.trim().toLowerCase() !== invitation.email) {
    return (
      <Shell>
        {header}
        <p
          role="alert"
          className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800"
        >
          This invitation belongs to a different email address. You are signed
          in as {auth.user.email}.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          Back to your workspace
        </Link>
      </Shell>
    );
  }

  // Signed in with the invited address — accept directly.
  if (auth) {
    return (
      <Shell>
        {header}
        <div className="mt-6">
          <AcceptAsCurrentUser token={parsedToken.data} />
        </div>
      </Shell>
    );
  }

  // Anonymous: existing account → sign in; otherwise create one here.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, invitation.email))
    .limit(1);

  if (existing.length > 0) {
    return (
      <Shell>
        {header}
        <p className="mt-6 text-sm text-slate-600">
          You already have a NexaFlow account. Sign in to accept this
          invitation.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          Sign in to accept
        </Link>
        <p className="mt-3 text-center text-xs text-slate-500">
          Return to this link after signing in.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      {header}
      <div className="mt-6">
        <AcceptWithNewAccount
          token={parsedToken.data}
          email={invitation.email}
        />
      </div>
    </Shell>
  );
}
