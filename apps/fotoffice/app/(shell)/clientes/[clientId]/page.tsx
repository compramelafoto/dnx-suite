import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireClientsViewer } from "@/lib/clients/access";
import { getClient, listMembersAvailableToLink } from "@/lib/clients/repository";
import { clientDisplayName } from "@/lib/clients/display";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
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
  const { user, workspace, canEdit } = await requireClientsViewer();
  const { clientId } = await params;
  const query = await searchParams;

  const cliente = await getClient(workspace.id, clientId);
  if (!cliente) notFound();

  const socios = canEdit ? await listMembersAvailableToLink(workspace.id, cliente.member?.id ?? null) : [];

  // El módulo de Caja es de otro workspace-feature: si está apagado acá, no hay libro que
  // mostrar. Ocultar la sección entera evita el error de la Tarea 11 —un texto fijo de "no
  // hay movimientos" que mentía incluso cuando sí los había— sin reemplazarlo por un cartel
  // vacío igual de inútil cuando el módulo ni siquiera está encendido. Con roles, además, ver
  // Clientes no da derecho a ver la plata: el consumo sale del libro de Caja, así que pide al
  // menos VIEW en Caja (el nivel ya incluye que el módulo esté encendido).
  const cajaHabilitada = hasLevel(await getModuleLevel(user.id, workspace.id, CASH_MODULE_KEY), "VIEW");
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

      {/*
        Sin MANAGE la ficha se ve igual, pero deshabilitada: `fieldset disabled` apaga cada campo
        y el botón de guardar sin tocar el formulario. La acción igual rebota del lado del servidor.
      */}
      <fieldset disabled={!canEdit} className="contents">
        <ClientForm client={cliente} error={query.error} />
      </fieldset>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">¿Es socio?</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          {cliente.member
            ? `Esta ficha está enlazada con el socio N° ${cliente.member.memberNumber}.`
            : canEdit
              ? "Si esta persona también es socio de la institución, elegilo acá para enlazar las dos fichas."
              : "Esta ficha no está enlazada con ningún socio."}
        </p>
        {canEdit ? (
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
        ) : null}
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
