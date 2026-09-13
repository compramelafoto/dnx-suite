import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireClientsStaff } from "@/lib/clients/access";
import { getClient } from "@/lib/clients/repository";
import { clientDisplayName } from "@/lib/clients/display";
import { ClientForm } from "../client-form";

export const dynamic = "force-dynamic";

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireClientsStaff();
  const { clientId } = await params;
  const query = await searchParams;

  const cliente = await getClient(workspace.id, clientId);
  if (!cliente) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={clientDisplayName(cliente)}
        description={`Cliente N° ${cliente.clientNumber}${cliente.member ? ` — también es socio N° ${cliente.member.memberNumber}` : ""}.`}
      />

      {query.ok ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, se guardó.</p>
      ) : null}

      <ClientForm client={cliente} error={query.error} />

      <section className="fo-card space-y-2 p-5">
        <h2 className="text-base font-semibold">Consumo</h2>
        {/* La Tarea 11 va a listar acá los movimientos de caja de este cliente. */}
        <p className="text-sm text-[var(--fo-muted)]">Todavía no hay movimientos.</p>
      </section>
    </div>
  );
}
