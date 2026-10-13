import type { OrganizationMember } from "@/server/data/members";
import type { AuthContext } from "@/server/auth";
import { countTasksByAssignee } from "@/server/data/tasks";
import { TeamRoleControl } from "./team-role-control";
import { RemoveMemberButton } from "./remove-member-button";

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const roleChip: Record<string, string> = {
  owner: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  admin: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  member: "bg-amber-50 text-amber-700 ring-amber-600/20",
  /** read-only view */
};

/**
 * Team table. Member and email are shown for everyone; management controls
 * (change role, remove) are rendered only for the organization owner and
 * never for the owner row itself. Deletion wording reflects the verified
 * behaviour: assigned tasks become unassigned.
 */
export async function TeamTable({
  members,
  ctx,
  canManage,
  viewingUserId,
}: {
  members: OrganizationMember[];
  ctx: AuthContext;
  canManage: boolean;
  viewingUserId: string;
}) {
  const assignmentCounts = await Promise.all(
    members.map((member) =>
      countTasksByAssignee(ctx, member.userId),
    ),
  );

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-5 py-3">Member</th>
              <th scope="col" className="px-5 py-3">Email</th>
              <th scope="col" className="px-5 py-3">Role</th>
              <th scope="col" className="px-5 py-3">Joined</th>
              {canManage ? (
                <th scope="col" className="px-5 py-3 text-end">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((member, index) => {
              const isOwnerRow = member.role === "owner";
              const isSelf = member.userId === viewingUserId;
              const assignCount = assignmentCounts[index] ?? 0;
              return (
                <tr key={member.membershipId} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                        {initials(member.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {member.name}
                          {isSelf ? (
                            <span className="ms-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              You
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{member.email}</td>
                  <td className="px-5 py-3.5">
                    {canManage && !isOwnerRow ? (
                      <TeamRoleControl
                        membershipId={member.membershipId}
                        memberName={member.name}
                        currentRole={member.role}
                      />
                    ) : (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${roleChip[member.role]}`}
                      >
                        {ROLE_LABELS[member.role] ?? member.role}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {formatDate(member.joinedAt)}
                  </td>
                  {canManage ? (
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {isOwnerRow ? (
                          <span className="text-xs text-slate-400">
                            Owner
                          </span>
                        ) : (
                          <RemoveMemberButton
                            membershipId={member.membershipId}
                            memberName={member.name}
                            assignmentCount={assignCount}
                          />
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 lg:hidden">
        {members.map((member, index) => {
          const isOwnerRow = member.role === "owner";
          const isSelf = member.userId === viewingUserId;
          const assignCount = assignmentCounts[index] ?? 0;
          return (
            <li
              key={member.membershipId}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                  {initials(member.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-slate-900">
                      {member.name}
                    </p>
                    {isSelf ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                        You
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-sm text-slate-500">
                    {member.email}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${roleChip[member.role]}`}
                >
                  {ROLE_LABELS[member.role] ?? member.role}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                <span>Joined {formatDate(member.joinedAt)}</span>
                {canManage ? (
                  isOwnerRow ? (
                    <span>Owner</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <TeamRoleControl
                        membershipId={member.membershipId}
                        memberName={member.name}
                        currentRole={member.role}
                      />
                      <RemoveMemberButton
                        membershipId={member.membershipId}
                        memberName={member.name}
                        assignmentCount={assignCount}
                      />
                    </span>
                  )
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
