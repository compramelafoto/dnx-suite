import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ApplicationCard } from "@/components/membership/application-card";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import { getWorkspaceCollectionStatus } from "@/lib/payments/connect/status";
import { listPendingApplications } from "@/lib/membership/inbox";
import { getActiveFeeValue } from "@/lib/membership/settings";

export const dynamic = "force-dynamic";

/**
 * Bandeja de solicitudes de asociación.
 *
 * La Secretaría resuelve acá, sin acta: el informe de altas para presentar en sesión de
 * comisión directiva corresponde al módulo de actas. Lo que sí queda registrado es quién
 * aprobó y cuándo, que es lo que ese informe va a necesitar.
 */
export default async function SolicitudesPage() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  const puedeResolver = await canManageWorkspaceCollection(user.id, workspace.id);
  if (!puedeResolver) redirect("/members");

  const [items, cobros, valorCuota] = await Promise.all([
    listPendingApplications(workspace.id),
    getWorkspaceCollectionStatus(workspace.id),
    getActiveFeeValue(workspace.id, null, new Date()),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Solicitudes de asociación"
        description="Revisá y resolvé los pedidos de ingreso. Al aprobar se crea el socio y se generan sus cuotas de ingreso."
      />

      {/* Dos condiciones sin las cuales aprobar no sirve de nada: se avisan antes, no al fallar. */}
      {!cobros.canReceiveSplit ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]">
          Todavía no podés cobrar cuotas.{" "}
          <Link href="/workspace/configuracion/cobros" className="underline">
            Conectá tu cuenta de MercadoPago
          </Link>{" "}
          antes de aprobar solicitudes: si no, se generarían cuotas que nadie puede pagar.
        </p>
      ) : null}

      {!valorCuota ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]">
          Todavía no configuraste el valor de la cuota. Sin eso no se pueden aprobar
          solicitudes, porque se generarían cargos en cero.
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="fo-card p-5 text-sm text-[var(--fo-muted)]">
          No hay solicitudes pendientes.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-[var(--fo-muted)]">
            {items.length} {items.length === 1 ? "solicitud pendiente" : "solicitudes pendientes"}
          </p>
          {items.map((item) => (
            <ApplicationCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
