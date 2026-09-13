import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireClientsStaff } from "@/lib/clients/access";
import { getClient, listMembersAvailableToLink } from "@/lib/clients/repository";
import { clientDisplayName } from "@/lib/clients/display";
import { ClientForm } from "../client-form";
import { linkClientToMemberAction } from "../actions";

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

  const socios = await listMembersAvailableToLink(workspace.id, cliente.member?.id ?? null);

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

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">¿Es socio?</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          {cliente.member
            ? `Esta ficha está enlazada con el socio N° ${cliente.member.memberNumber}.`
            : "Si esta persona también es socio de la institución, elegilo acá para enlazar las dos fichas."}
        </p>
        <form action={linkClientToMemberAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="clientId" value={cliente.id} />
          <div className="fo-field-stack sm:max-w-xs">
            <label className="fo-label" htmlFor="memberId">
              Socio
            </label>
            <select
              id="memberId"
              name="memberId"
              className="fo-input"
              defaultValue={cliente.member?.id ?? ""}
            >
              <option value="">No es socio</option>
              {socios.map((s) => (
                <option key={s.id} value={s.id}>
                  N° {s.memberNumber} — {s.fullName}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="fo-btn fo-btn-secondary text-sm">
            Guardar enlace
          </button>
        </form>
      </section>

      <section className="fo-card space-y-2 p-5">
        <h2 className="text-base font-semibold">Consumo</h2>
        {/* La Tarea 11 va a listar acá los movimientos de caja de este cliente. */}
        <p className="text-sm text-[var(--fo-muted)]">Todavía no hay movimientos.</p>
      </section>
    </div>
  );
}
