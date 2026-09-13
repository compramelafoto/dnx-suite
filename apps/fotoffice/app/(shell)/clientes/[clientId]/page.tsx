import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireClientsStaff } from "@/lib/clients/access";
import { getClient, listMembersAvailableToLink } from "@/lib/clients/repository";
import { clientDisplayName } from "@/lib/clients/display";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { listMovements } from "@/lib/cash/repository";
import { MovementsTable } from "@/app/(shell)/caja/movements-table";
import { ClientForm } from "../client-form";
import { linkClientToMemberAction } from "../actions";

/** Cuántos movimientos recientes se muestran en la ficha: es un resumen, no el libro completo. */
const MOVIMIENTOS_RECIENTES = 20;

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

  // El módulo de Caja es de otro workspace-feature: si está apagado acá, no hay libro que
  // mostrar. Ocultar la sección entera evita el error de la Tarea 11 —un texto fijo de "no
  // hay movimientos" que mentía incluso cuando sí los había— sin reemplazarlo por un cartel
  // vacío igual de inútil cuando el módulo ni siquiera está encendido.
  const cajaHabilitada = await isModuleEnabledForWorkspace(workspace.id, CASH_MODULE_KEY);
  const movimientos = cajaHabilitada
    ? await listMovements(workspace.id, { clientId: cliente.id, take: MOVIMIENTOS_RECIENTES })
    : [];

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

      {cajaHabilitada ? (
        <section className="fo-card space-y-3 p-5">
          <h2 className="text-base font-semibold">Consumo</h2>
          <MovementsTable movements={movimientos} showAccount />
        </section>
      ) : null}
    </div>
  );
}
