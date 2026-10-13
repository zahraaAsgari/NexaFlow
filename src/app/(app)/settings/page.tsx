import { requireContext } from "@/server/auth";
import { SettingsForm } from "./settings-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

/**
 * Organization Settings. The Settings page is viewable by any authenticated
 * member of the active organization; organization data comes from
 * requireContext() — never from client input. Mutations are owner-only and
 * enforced server-side (the form hides the Save button for non-owners),
 * matching the existing Team authorization model.
 */
export default async function SettingsPage() {
  const ctx = await requireContext();
  const isOwner = ctx.membership.role === "owner";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Organization settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage how {ctx.organization.name} appears across your workspace.
        </p>
      </header>

      {!isOwner ? (
        <div
          role="note"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm"
        >
          Only the organization owner can change these settings. You are viewing
          with read-only access.
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Organization profile"
          description="The name and identifier shown throughout NexaFlow."
        />
        <CardContent>
          {isOwner ? (
            <SettingsForm
              defaults={{ name: ctx.organization.name, slug: ctx.organization.slug }}
            />
          ) : (
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Name
                </dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {ctx.organization.name}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Slug
                </dt>
                <dd className="mt-1 font-mono text-sm text-slate-900">
                  {ctx.organization.slug}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Your role
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                    <Icon name="check" className="h-3.5 w-3.5" />
                    {ctx.membership.role}
                  </span>
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="About these settings"
          description=""
        />
        <CardContent>
          <p className="text-sm text-slate-600">
            Renaming your organization updates every place the name appears —
            the sidebar, dashboard, team directory, and recent-work lists — for
            everyone in the organization, immediately. The slug identifier
            follows automatically and stays unique across NexaFlow.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
