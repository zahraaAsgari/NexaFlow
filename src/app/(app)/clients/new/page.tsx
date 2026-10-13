import Link from "next/link";
import { redirect } from "next/navigation";

import { requireContext } from "@/server/auth";
import { createClientAction } from "@/server/actions/clients";
import { ClientForm } from "@/components/clients/client-form";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const ctx = await requireContext();
  // Members cannot manage clients; the server action enforces the same rule.
  if (ctx.membership.role === "member") redirect("/clients");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-500 outline-none transition hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
          Back to clients
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          New client
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Add a customer to {ctx.organization.name}.
        </p>
      </div>

      <Card className="p-6">
        <ClientForm
          action={createClientAction}
          defaults={{ name: "", email: "", company: "", status: "active" }}
          submitLabel="Create client"
          pendingLabel="Creating…"
          cancelHref="/clients"
          showStatus={false}
        />
      </Card>
    </div>
  );
}
