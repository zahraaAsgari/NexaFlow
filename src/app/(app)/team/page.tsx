import Link from "next/link";

import { requireContext } from "@/server/auth";
import {
  MEMBERS_PAGE_SIZE,
  countMembers,
  listMembers,
} from "@/server/data/members";
import { teamSearchParamsSchema } from "@/server/validation/members";
import { MemberSearch } from "@/components/members/member-search";
import { InviteMemberButton } from "@/components/members/invite-member";
import { PendingInvitations } from "@/components/members/pending-invitations";
import { listPendingInvitations } from "@/server/data/invitations";
import { TeamTable } from "@/components/members/team-table";
import { EmptyState } from "@/components/app/empty-state";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TeamPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requireContext();
  const isOwner = ctx.membership.role === "owner";

  const raw = await searchParams;
  const parsed = teamSearchParamsSchema.safeParse({
    q: typeof raw.q === "string" ? raw.q : "",
    page: typeof raw.page === "string" ? raw.page : undefined,
  });
  const q = parsed.success ? parsed.data.q : "";
  const requestedPage = parsed.success ? parsed.data.page : 1;

  const total = await countMembers(ctx, q || undefined);
  const totalPages = Math.max(1, Math.ceil(total / MEMBERS_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const rows = await listMembers(ctx, {
    q: q || undefined,
    limit: MEMBERS_PAGE_SIZE,
    offset: (page - 1) * MEMBERS_PAGE_SIZE,
  });

  const orgTotal = q ? await countMembers(ctx) : total;
  // Owner-only: pending invitations for the ACTIVE organization.
  const pendingInvitations = isOwner ? await listPendingInvitations(ctx) : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Team
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            The people who belong to {ctx.organization.name}, and what they can
            do.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <MemberSearch q={q} />
        {isOwner ? <InviteMemberButton /> : null}
      </div>

      {isOwner ? (
        <PendingInvitations invitations={pendingInvitations} canManage />
      ) : null}

      {total === 0 && !q ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white">
          <EmptyState
            icon="users"
            title="No members yet."
            description="Members will appear here once they join your organization."
          />
        </div>
      ) : total === 0 && q ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white">
          <EmptyState
            icon="search"
            title="No members match your search."
            description={`No one in ${ctx.organization.name} matches that search.`}
          >
            <Link
              href="/team"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            >
              Clear search
            </Link>
          </EmptyState>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {q
              ? `${total} ${total === 1 ? "result" : "results"} for that search of ${orgTotal} members`
              : `${total} ${total === 1 ? "member" : "members"}`}
          </p>

          <TeamTable
            members={rows}
            ctx={ctx}
            canManage={isOwner}
            viewingUserId={ctx.user.id}
          />

          {totalPages > 1 ? (
            <nav
              aria-label="Team pagination"
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
            >
              {page > 1 ? (
                <PaginationLink q={q} page={page - 1} label="Previous" />
              ) : (
                <span className="text-slate-300">Previous</span>
              )}
              <span className="text-slate-500">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <PaginationLink q={q} page={page + 1} label="Next" />
              ) : (
                <span className="text-slate-300">Next</span>
              )}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

function PaginationLink({
  q,
  page,
  label,
}: {
  q: string;
  page: number;
  label: string;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  return (
    <Link
      href={`/team?${params.toString()}`}
      className="rounded-md px-2 py-1 font-medium text-indigo-600 outline-none hover:text-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
    >
      {label}
    </Link>
  );
}
