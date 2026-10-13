import type { PendingInvitation } from "@/server/data/invitations";
import { Card, CardHeader } from "@/components/ui/card";
import { RevokeInvitationButton } from "./revoke-invitation-button";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Pending invitations for the active organization. Only the owner sees this
 * section (the page decides); invitation links are never re-displayed here —
 * the database holds only their hashes.
 */
export function PendingInvitations({
  invitations,
  canManage,
}: {
  invitations: PendingInvitation[];
  canManage: boolean;
}) {
  if (invitations.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Pending invitations"
        description={`${invitations.length} invitation${invitations.length === 1 ? "" : "s"} waiting to be accepted`}
      />
      <ul className="divide-y divide-slate-100">
        {invitations.map((invitation) => (
          <li
            key={invitation.id}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {invitation.email}
              </p>
              <p className="text-xs text-slate-500">
                {ROLE_LABELS[invitation.role] ?? invitation.role} · expires{" "}
                {formatDate(invitation.expiresAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                Pending
              </span>
              {canManage ? (
                <RevokeInvitationButton
                  invitationId={invitation.id}
                  email={invitation.email}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
