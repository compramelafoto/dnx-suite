import { notFound } from "next/navigation";
import { AdminFlashMessage } from "@/components/admin/AdminFlashMessage";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
import { EditionDeleteButton } from "@/components/admin/editions/EditionDeleteButton";
import { EditionDetailActions } from "@/components/admin/editions/EditionDetailActions";
import { JuryHandoffCard } from "@/components/admin/jury/JuryHandoffCard";
import { AdminDataTable, AdminTableLink } from "@/components/admin/AdminDataTable";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getAdminIntegrations } from "@/config/admin/integrations";
import { adminRoutes } from "@/config/admin/navigation";
import { marathonRegistrationPath } from "@/config/navigation";
import { siteConfig } from "@/config/site";
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
import { TECHNICAL_VS_JURY_ADMIN } from "@/lib/jury-results/ui/jury-results-status-presentation";

function presentEditionSyncStatus(status: string | null | undefined): string {
  switch (status) {
    case "PENDING":
      return "Pendiente de envío";
    case "SYNCED":
      return "Enviada correctamente";
    case "RETRY_PENDING":
      return "Reintento pendiente";
    case "FAILED":
      return "No se pudo enviar";
    case "MANUAL_REVIEW":
      return "Necesita revisión";
    default:
      return status ? "Estado a revisar" : "Sin estado";
  }
}

function presentValidationStatus(status: string | null | undefined): string {
  switch (status) {
    case "VALID":
      return "Vínculo válido";
    case "INVALID":
      return "Vínculo con problemas";
    case "PENDING":
      return "Pendiente de validar";
    default:
      return status ? "Validación a revisar" : "Sin validar";
  }
}

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
  const integrations = getAdminIntegrations();
  const fr = await getEditionFotoRankAdminData(editionId);
  const salesUrl = `${siteConfig.url}${marathonRegistrationPath(edition.slug)}`;

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
          <EditionDetailActions
            editionId={edition.id}
            editionName={edition.name}
            isPublished={edition.isPublished}
            salesUrl={salesUrl}
          />
        }
      />

      <AdminFlashMessage flash={flash} />

      <Card variant="outlined" className="space-y-4 p-5">
        <AdminStatusBadge status={edition.status} published={edition.isPublished} />
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">Identificador de URL</dt>
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
            <dd className="text-sm text-ck-text">
              {edition.fotorankContestId ? "Concurso vinculado" : "Sin vincular"}
            </dd>
          </div>
        </dl>
        {edition.description ? (
          <p className="text-sm leading-relaxed text-ck-text-secondary">{edition.description}</p>
        ) : null}
      </Card>

      <JuryHandoffCard
        editionId={editionId}
        fotorankAdminHref={integrations.fotorank.href}
        admissionHref={`${adminRoutes.editions}/${editionId}/admision`}
      />

      <Card variant="outlined" className="space-y-4 p-5">
        <h2 className="text-lg font-semibold">Vínculo con FotoRank</h2>
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          {TECHNICAL_VS_JURY_ADMIN} Este bloque gestiona el envío de inscripciones a FotoRank
          después del pago. Si el envío falla, la inscripción paga se conserva en Clickatón.
        </p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            Validación del vínculo:{" "}
            <Badge
              variant={
                edition.fotoRankValidationStatus === "VALID" ? "success" : "warning"
              }
            >
              {presentValidationStatus(edition.fotoRankValidationStatus)}
            </Badge>
          </div>
          <div>
            Envío automático:{" "}
            {edition.fotoRankSyncEnabled ? "habilitado" : "deshabilitado"}
          </div>
          <div>
            Última validación:{" "}
            {edition.fotoRankLastValidatedAt
              ? formatAdminDateTime(edition.fotoRankLastValidatedAt)
              : "Todavía no se validó"}
          </div>
          <div>Pendientes de envío: {fr.stats.PENDING ?? 0}</div>
          <div>Enviadas correctamente: {fr.stats.SYNCED ?? 0}</div>
          <div>
            Con error o reintento:{" "}
            {(fr.stats.RETRY_PENDING ?? 0) + (fr.stats.FAILED ?? 0)}
          </div>
          <div>Necesitan revisión: {fr.stats.MANUAL_REVIEW ?? 0}</div>
        </dl>
        {edition.fotoRankValidationError ? (
          <p className="text-sm text-amber-700">
            No pudimos validar el vínculo. Revisá el concurso en FotoRank e intentá nuevamente.
          </p>
        ) : null}
        <form
          action={saveEditionFotoRankLinkFormAction.bind(null, editionId)}
          className="space-y-3 rounded border border-ck-border p-4"
        >
          <label className="block space-y-2 text-sm">
            <span className="text-ck-text-secondary">Identificador del concurso en FotoRank</span>
            <input
              name="fotorankContestId"
              defaultValue={edition.fotorankContestId ?? ""}
              className="block min-h-11 w-full rounded border border-ck-border bg-ck-surface px-3 py-2"
              placeholder="Identificador del concurso"
              aria-label="Identificador del concurso en FotoRank"
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="fotoRankSyncEnabled"
              defaultChecked={edition.fotoRankSyncEnabled}
            />
            Enviar inscripciones a FotoRank después del pago
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="primary" className="min-h-11">
              Guardar vínculo
            </Button>
          </div>
        </form>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <form action={validateEditionFotoRankContestFormAction.bind(null, editionId)}>
            <Button type="submit" variant="secondary" className="min-h-11 w-full sm:w-auto">
              Comprobar vínculo del concurso
            </Button>
          </form>
          <form action={retryAllPendingFotoRankSyncFormAction.bind(null, editionId)}>
            <Button type="submit" variant="secondary" className="min-h-11 w-full sm:w-auto">
              Volver a intentar envíos pendientes
            </Button>
          </form>
        </div>
        {fr.recent.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {fr.recent.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 border-b border-ck-border/50 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <span className="font-medium text-ck-text">
                    {presentEditionSyncStatus(row.status)}
                  </span>
                  {row.lastErrorCode ? (
                    <span className="mt-1 block text-xs text-ck-text-muted">
                      Hubo un problema al enviar. Podés reintentar o marcar para revisión.
                    </span>
                  ) : null}
                </span>
                <span className="flex flex-col gap-2 sm:flex-row">
                  <form action={retryFotoRankSyncFormAction.bind(null, editionId)}>
                    <input type="hidden" name="syncId" value={row.id} />
                    <Button type="submit" variant="text" size="sm" className="min-h-11">
                      Volver a intentar el envío
                    </Button>
                  </form>
                  <form action={markFotoRankSyncManualReviewFormAction.bind(null, editionId)}>
                    <input type="hidden" name="syncId" value={row.id} />
                    <Button type="submit" variant="text" size="sm" className="min-h-11">
                      Marcar para revisión
                    </Button>
                  </form>
                </span>
                <AdminTechnicalInfo
                  className="w-full"
                  title="Información técnica del envío"
                  rows={[
                    {
                      label: "ID de inscripción",
                      value: row.registrationId,
                      mono: true,
                      copyText: row.registrationId,
                    },
                    {
                      label: "ID de sincronización",
                      value: row.id,
                      mono: true,
                      copyText: row.id,
                    },
                    {
                      label: "Estado interno",
                      value: row.status,
                      mono: true,
                    },
                    {
                      label: "Participante FotoRank",
                      value: row.fotoRankParticipantId ?? "—",
                      mono: true,
                    },
                    {
                      label: "Código de error",
                      value: row.lastErrorCode ?? "—",
                      mono: true,
                    },
                    {
                      label: "Modo de sync",
                      value: edition.fotoRankSyncMode ?? "—",
                      mono: true,
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ck-text-muted">
            Todavía no hay envíos de inscripción a FotoRank.
          </p>
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
