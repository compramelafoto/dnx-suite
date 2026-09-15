import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireCoveragesReviewer } from "@/lib/coverages/access";
import { fechaArgentina } from "@/lib/coverages/format";
import { INBOX_FILTERS, isInboxFilter } from "@/lib/coverages/inbox-filters";
import { listRequests, loadSettings } from "@/lib/coverages/repository";
import { requestStatusLabel } from "@/lib/coverages/states";
import { terminologyFor } from "@/lib/coverages/terminology";

export const dynamic = "force-dynamic";

/**
 * La bandeja de la coordinación.
 *
 * Ordenada por fecha de la actividad y no por fecha de carga: lo que urge es lo que ocurre
 * primero, no lo que entró primero. Un pedido de ayer para dentro de seis meses puede esperar;
 * uno de hace una hora para el sábado, no.
 */
export default async function CoberturasPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { workspace } = await requireCoveragesReviewer();
  const { filtro } = await searchParams;
  const activo = isInboxFilter(filtro) ? filtro : "nuevas";

  const [settings, solicitudes] = await Promise.all([
    loadSettings(workspace.id),
    listRequests({ workspaceId: workspace.id, filter: activo }),
  ]);
  const t = terminologyFor(settings);

  return (
    <div className="space-y-6">
      <PageHeader title={t.module} description={`Los pedidos que recibe ${workspace.name}.`} />

      <nav className="flex flex-wrap gap-2" aria-label="Filtros">
        {INBOX_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/coberturas?filtro=${f.key}`}
            aria-current={f.key === activo ? "page" : undefined}
            className={`rounded-full border px-3 py-2 text-sm ${
              f.key === activo
                ? "border-[var(--fo-text)] bg-[var(--fo-text)] text-[var(--fo-bg)]"
                : "border-[var(--fo-border)]"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {solicitudes.length === 0 ? (
        <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">
          No hay nada acá. Cuando llegue un pedido nuevo va a aparecer en «Nuevas».
        </p>
      ) : (
        <ul className="space-y-3">
          {solicitudes.map((s) => (
            <li key={s.id}>
              <Link href={`/coberturas/${s.id}`} className="fo-card block space-y-1 p-4">
                <p className="text-xs tabular-nums text-[var(--fo-muted)]">{s.publicCode}</p>
                <p className="font-medium">{s.eventTitle}</p>
                <p className="text-sm text-[var(--fo-muted)]">
                  {s.client.businessName ?? `${s.client.firstName ?? ""} ${s.client.lastName ?? ""}`.trim()}
                  {" · "}
                  {fechaArgentina(s.startsAt)}
                  {s.city ? ` · ${s.city}` : ""}
                </p>
                <p className="text-xs text-[var(--fo-muted)]">{requestStatusLabel(s.status)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
