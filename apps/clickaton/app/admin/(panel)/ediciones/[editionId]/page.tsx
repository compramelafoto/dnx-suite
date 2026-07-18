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
