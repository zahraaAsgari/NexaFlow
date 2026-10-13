import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireContext } from "@/server/auth";
import { updateClientAction } from "@/server/actions/clients";
import { getClientById } from "@/server/data/clients";
import { clientParamsSchema } from "@/server/validation/clients";
import { ClientForm } from "@/components/clients/client-form";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditClientPage({ params }: { params: Params }) {
  const ctx = await requireContext();
  if (ctx.membership.role === "member") redirect("/clients");

  const parsed = clientParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();

  const client = await getClientById(ctx, parsed.data.id);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href={`/clients/${client.id}`}
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-500 outline-none transition hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
          Back to client
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          Edit client
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Update the details for {client.name}.
        </p>
      </div>

      <Card className="p-6">
        <ClientForm
          action={updateClientAction.bind(null, client.id)}
          defaults={{
            name: client.name,
            email: client.email ?? "",
            company: client.company ?? "",
            status: client.status,
          }}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          cancelHref={`/clients/${client.id}`}
          showStatus
        />
      </Card>
    </div>
  );
}
