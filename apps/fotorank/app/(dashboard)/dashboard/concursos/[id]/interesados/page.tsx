/**
 * Panel administrativo de interesados.
 *
 * Muestra sólo los datos necesarios para operar la campaña. Deliberadamente NO
 * expone correo ni documento: para contactar a los interesados se usan las
 * comunicaciones del sistema, que respetan consentimientos y bajas.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer } from "../../../../../components/PageContainer";
import { routes } from "../../../../../lib/routes";
import { requireAdminContestScope } from "../../../../../lib/fotorank/upcoming/admin-access";
import { getAdminInterestPanel } from "../../../../../lib/fotorank/upcoming/service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  CANCELLED: "Cancelado",
  CONVERTED: "Convertido",
};

function fmt(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
}

export default async function ContestInteresadosPage({ params }: PageProps) {
  const { id } = await params;
  const scope = await requireAdminContestScope(id);
  if (!scope.ok) notFound();

  const panel = await getAdminInterestPanel({
    contestId: scope.scope.contestId,
    organizationId: scope.scope.organizationId,
  });
  if (!panel) notFound();

  const { stats, rows, revenue } = panel;

  return (
    <PageContainer
      title="Interesados"
      description="Personas que pidieron recibir el aviso de apertura de este concurso."
    >
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            { label: "Total", value: stats.total },
            { label: "Activos", value: stats.active },
            { label: "Cancelados", value: stats.cancelled },
            { label: "Convertidos", value: stats.converted },
            { label: "Con beneficio", value: stats.benefitEligible },
          ].map((s) => (
            <div key={s.label} className="fr-recuadro border border-fr-border bg-fr-card p-4">
              <p className="text-xs uppercase tracking-wider text-fr-muted">{s.label}</p>
              <p className="mt-2 text-2xl font-semibold text-fr-primary">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="fr-recuadro border border-fr-border bg-fr-card p-4">
          <p className="text-xs uppercase tracking-wider text-fr-muted">Tasa de conversión</p>
          <p className="mt-2 text-2xl font-semibold text-fr-primary">{stats.conversionRate}%</p>
        </div>

        <div className="fr-recuadro border border-fr-border bg-fr-card p-4">
          <p className="text-xs uppercase tracking-wider text-fr-muted">Recaudación</p>
          <p className="mt-2 text-sm text-fr-muted">
            {revenue.available
              ? "Disponible."
              : "No disponible: se calcula cuando DNX Payments esté integrado y habilitado."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={routes.dashboard.concursos.interesadosCsv(id)}
            className="fr-btn fr-btn-secondary inline-flex w-fit"
            prefetch={false}
          >
            Exportar CSV
          </Link>
          <Link
            href={routes.dashboard.concursos.detalle(id)}
            className="fr-btn fr-btn-secondary inline-flex w-fit"
          >
            Volver al concurso
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="fr-body text-fr-muted">
            Todavía no hay interesados registrados. Mientras el concurso esté en borrador la
            tarjeta pública no se muestra, así que no puede recibir registros.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead className="border-b border-fr-border text-xs uppercase tracking-wider text-fr-muted">
                <tr>
                  <th className="py-3 pr-4">Usuario</th>
                  <th className="py-3 pr-4">Estado</th>
                  <th className="py-3 pr-4">Registro</th>
                  <th className="py-3 pr-4">Beneficio</th>
                  <th className="py-3 pr-4">Vence</th>
                  <th className="py-3 pr-4">Origen</th>
                  <th className="py-3 pr-4">Cons. concurso</th>
                  <th className="py-3 pr-4">Cons. general</th>
                  <th className="py-3 pr-4">Provincia</th>
                  <th className="py-3 pr-4">Localidad</th>
                  <th className="py-3 pr-4">Paquete</th>
                </tr>
              </thead>
              <tbody className="text-fr-primary">
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-fr-border/40">
                    <td className="py-3 pr-4">{r.displayName}</td>
                    <td className="py-3 pr-4">{STATUS_LABELS[r.status] ?? r.status}</td>
                    <td className="py-3 pr-4">{fmt(r.registeredAt)}</td>
                    <td className="py-3 pr-4">{r.benefitEligible ? "Sí" : "No"}</td>
                    <td className="py-3 pr-4">{fmt(r.benefitDeadlineAt)}</td>
                    <td className="py-3 pr-4">{r.source}</td>
                    <td className="py-3 pr-4">{r.contestSpecificOptIn ? "Sí" : "No"}</td>
                    <td className="py-3 pr-4">{r.generalOptIn ? "Sí" : "No"}</td>
                    <td className="py-3 pr-4">{r.province ?? "—"}</td>
                    <td className="py-3 pr-4">{r.city ?? "—"}</td>
                    <td className="py-3 pr-4">{r.selectedPackageCode ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
