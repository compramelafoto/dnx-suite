import { notFound } from "next/navigation";
import { AdminFlashMessage } from "@/components/admin/AdminFlashMessage";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { EditionDeleteButton } from "@/components/admin/editions/EditionDeleteButton";
import { EditionUnpublishButton } from "@/components/admin/venues/VenueActionButtons";
import { AdminDataTable, AdminTableLink } from "@/components/admin/AdminDataTable";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { formatAdminDateTime } from "@/lib/admin/datetime-input";
import { getEditionById } from "@/lib/admin/editions/queries";
import { listVenuesByEditionId } from "@/lib/admin/venues/queries";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import {
  getEditionFotoRankAdminData,
  markFotoRankSyncManualReviewFormAction,
  retryAllPendingFotoRankSyncFormAction,
  retryFotoRankSyncFormAction,
  saveEditionFotoRankLinkFormAction,
  validateEditionFotoRankContestFormAction,
} from "@/lib/fotorank-sync/actions/fotorank-sync-admin";
import { Badge } from "@/components/ui/Badge";

type Props = {
  params: Promise<{ editionId: string }>;
  searchParams: Promise<{ flash?: string }>;
};

export default async function EditionDetailPage({ params, searchParams }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;
  const { flash } = await searchParams;

  const editionResult = await getEditionById(editionId);
  if (!editionResult.ok) {
    return (
      <div className="space-y-6">
        <AdminMigrationNotice message={editionResult.message} />
      </div>
    );
  }
  if (!editionResult.data) notFound();

  const edition = editionResult.data;
  const venuesResult = await listVenuesByEditionId(editionId);
  const venues = venuesResult.ok ? venuesResult.data : [];
  const fr = await getEditionFotoRankAdminData(editionId);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={edition.name}
        description={edition.shortDescription ?? "Detalle operativo de la edición."}
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name },
        ]}
        actions={
          <>
            <EditionUnpublishButton editionId={edition.id} isPublished={edition.isPublished} />
            <Button href={`${adminRoutes.editions}/${edition.id}/editar`} variant="secondary">
              Editar
            </Button>
            <Button href={`${adminRoutes.editions}/${edition.id}/precios`} variant="secondary">
              Precios
            </Button>
            <Button href={`${adminRoutes.editions}/${edition.id}/finanzas`} variant="secondary">
              Finanzas
            </Button>
            <Button href={`${adminRoutes.editions}/${edition.id}/cronograma`} variant="secondary">
              Cronograma
            </Button>
            <Button href={`${adminRoutes.editions}/${edition.id}/consignas`} variant="secondary">
              Consignas
            </Button>
            <Button href={`${adminRoutes.editions}/${edition.id}/envios`} variant="secondary">
              Envíos
            </Button>
            <Button href={`${adminRoutes.editions}/${edition.id}/admision`} variant="secondary">
              Admisión
            </Button>
            <Button href={`${adminRoutes.editions}/${edition.id}/acreditacion`} variant="secondary">
              Acreditación
            </Button>
            <Button href={`${adminRoutes.editions}/${edition.id}/sedes/nueva`} variant="primary">
              Nueva sede
            </Button>
          </>
        }
      />

      <AdminFlashMessage flash={flash} />

      <Card variant="outlined" className="space-y-4 p-5">
        <AdminStatusBadge status={edition.status} published={edition.isPublished} />
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">Slug</dt>
            <dd className="text-sm text-ck-text">{edition.slug}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">Zona horaria</dt>
            <dd className="text-sm text-ck-text">{edition.timezone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">Inscripciones</dt>
            <dd className="text-sm text-ck-text">
              {edition.registrationEnabled ? "Habilitadas" : "Deshabilitadas"} ·{" "}
              {edition.isPublished ? "Publicada" : "No publicada"} · {edition.currency}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">Inicio</dt>
            <dd className="text-sm text-ck-text">
              {formatAdminDateTime(edition.startAt, edition.timezone ?? undefined)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">Fin</dt>
            <dd className="text-sm text-ck-text">
              {formatAdminDateTime(edition.endAt, edition.timezone ?? undefined)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">Capacidad default</dt>
            <dd className="text-sm text-ck-text">{edition.defaultCapacity ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">FotoRank</dt>
            <dd className="text-sm text-ck-text">{edition.fotorankContestId ?? "Sin vincular"}</dd>
          </div>
        </dl>
        {edition.description ? (
          <p className="text-sm leading-relaxed text-ck-text-secondary">{edition.description}</p>
        ) : null}
      </Card>

      <Card variant="outlined" className="space-y-4 p-5">
        <h2 className="text-lg font-semibold">Integración FotoRank</h2>
        <p className="text-sm text-ck-text-secondary">
          Sync postpago durable. Si FotoRank falla, la inscripción permanece PAID. Placa /
          Instagram → Etapa 8.
        </p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            Validación:{" "}
            <Badge
              variant={
                edition.fotoRankValidationStatus === "VALID" ? "success" : "warning"
              }
            >
              {edition.fotoRankValidationStatus}
            </Badge>
          </div>
          <div>Sync: {edition.fotoRankSyncEnabled ? "habilitado" : "deshabilitado"}</div>
          <div>Modo: {edition.fotoRankSyncMode}</div>
          <div>
            Última validación:{" "}
            {edition.fotoRankLastValidatedAt
              ? formatAdminDateTime(edition.fotoRankLastValidatedAt)
              : "—"}
          </div>
          <div>Pendientes: {fr.stats.PENDING ?? 0}</div>
          <div>Syncados: {fr.stats.SYNCED ?? 0}</div>
          <div>Fallidos/retry: {(fr.stats.RETRY_PENDING ?? 0) + (fr.stats.FAILED ?? 0)}</div>
          <div>Revisión manual: {fr.stats.MANUAL_REVIEW ?? 0}</div>
        </dl>
        {edition.fotoRankValidationError ? (
          <p className="text-sm text-amber-700">{edition.fotoRankValidationError}</p>
        ) : null}
        <form
          action={saveEditionFotoRankLinkFormAction.bind(null, editionId)}
          className="space-y-3 rounded border border-ck-border p-4"
        >
          <label className="block space-y-2 text-sm">
            <span className="text-ck-text-secondary">ID concurso FotoRank</span>
            <input
              name="fotorankContestId"
              defaultValue={edition.fotorankContestId ?? ""}
              className="block w-full rounded border border-ck-border bg-ck-surface px-3 py-2"
              placeholder="cuid del FotorankContest"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="fotoRankSyncEnabled"
              defaultChecked={edition.fotoRankSyncEnabled}
            />
            Habilitar sync postpago
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="primary">
              Guardar vínculo
            </Button>
          </div>
        </form>
        <div className="flex flex-wrap gap-3">
          <form action={validateEditionFotoRankContestFormAction.bind(null, editionId)}>
            <Button type="submit" variant="secondary">
              Validar concurso
            </Button>
          </form>
          <form action={retryAllPendingFotoRankSyncFormAction.bind(null, editionId)}>
            <Button type="submit" variant="secondary">
              Reintentar pendientes
            </Button>
          </form>
        </div>
        {fr.recent.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {fr.recent.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-ck-border/50 py-2"
              >
                <span>
                  <code className="text-xs">{row.registrationId.slice(0, 8)}…</code> ·{" "}
                  {row.status}
                  {row.fotoRankParticipantId
                    ? ` · FR ${row.fotoRankParticipantId.slice(0, 8)}…`
                    : ""}
                  {row.lastErrorCode ? ` · ${row.lastErrorCode}` : ""}
                </span>
                <span className="flex gap-2">
                  <form action={retryFotoRankSyncFormAction.bind(null, editionId)}>
                    <input type="hidden" name="syncId" value={row.id} />
                    <Button type="submit" variant="text" size="sm">
                      Reintentar
                    </Button>
                  </form>
                  <form action={markFotoRankSyncManualReviewFormAction.bind(null, editionId)}>
                    <input type="hidden" name="syncId" value={row.id} />
                    <Button type="submit" variant="text" size="sm">
                      Manual
                    </Button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ck-text-muted">Sin sincronizaciones todavía.</p>
        )}
      </Card>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-ck-display)] text-2xl tracking-wide text-ck-text">
            Sedes
          </h2>
          <Button href={`${adminRoutes.editions}/${edition.id}/sedes/nueva`} variant="text" size="sm">
            Agregar sede
          </Button>
        </div>
        {!venuesResult.ok ? (
          <AdminMigrationNotice message={venuesResult.message} />
        ) : (
          <AdminDataTable
            rows={venues}
            rowKey={(row) => row.id}
            emptyMessage="Esta edición aún no tiene sedes."
            columns={[
              {
                key: "name",
                header: "Sede",
                cell: (row) => (
                  <AdminTableLink href={`${adminRoutes.venues}/${row.id}`}>{row.name}</AdminTableLink>
                ),
              },
              {
                key: "city",
                header: "Ciudad",
                cell: (row) => row.city,
              },
              {
                key: "active",
                header: "Estado",
                cell: (row) => <AdminStatusBadge kind="venue" status="DRAFT" active={row.isActive} />,
              },
              {
                key: "capacity",
                header: "Capacidad",
                cell: (row) => row.capacity ?? "—",
              },
            ]}
            mobileCard={(row) => (
              <>
                <AdminTableLink href={`${adminRoutes.venues}/${row.id}`}>{row.name}</AdminTableLink>
                <p className="text-sm text-ck-text-secondary">{row.city}</p>
                <AdminStatusBadge kind="venue" status="DRAFT" active={row.isActive} />
              </>
            )}
          />
        )}
      </section>

      <EditionDeleteButton
        editionId={edition.id}
        canDelete={edition.status === "DRAFT" && (edition.venueCount ?? 0) === 0}
        redirectTo={adminRoutes.editions}
      />
    </div>
  );
}
