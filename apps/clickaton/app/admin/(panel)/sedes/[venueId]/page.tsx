import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminFlashMessage } from "@/components/admin/AdminFlashMessage";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { VenueActionButtons } from "@/components/admin/venues/VenueActionButtons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { formatAdminDateTime } from "@/lib/admin/datetime-input";
import { getEditionById } from "@/lib/admin/editions/queries";
import { getVenueById } from "@/lib/admin/venues/queries";
import { requireClickatonAdmin } from "@/lib/admin/auth";

type Props = {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ flash?: string }>;
};

export default async function VenueDetailPage({ params, searchParams }: Props) {
  await requireClickatonAdmin();
  const { venueId } = await params;
  const { flash } = await searchParams;

  const venueResult = await getVenueById(venueId);
  if (!venueResult.ok) {
    return <AdminMigrationNotice message={venueResult.message} />;
  }
  if (!venueResult.data) notFound();

  const venue = venueResult.data;
  const editionResult = await getEditionById(venue.editionId);
  const edition = editionResult.ok ? editionResult.data : null;

  const canDelete =
    edition?.status === "DRAFT" ||
    (!venue.isActive && edition?.status !== "COMPLETED" && edition?.status !== "CANCELLED");

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={venue.name}
        description={`${venue.city}${venue.provinceOrState ? `, ${venue.provinceOrState}` : ""}`}
        breadcrumbs={[
          { label: "Sedes", href: adminRoutes.venues },
          { label: venue.name },
        ]}
        actions={
          <Button href={`${adminRoutes.venues}/${venue.id}/editar`} variant="primary">
            Editar
          </Button>
        }
      />

      <AdminFlashMessage flash={flash} />

      <Card variant="outlined" className="space-y-4 p-5">
        <AdminStatusBadge kind="venue" status="DRAFT" active={venue.isActive} />
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">Edición</dt>
            <dd className="text-sm text-ck-text">
              {edition ? (
                <Link href={`${adminRoutes.editions}/${edition.id}`} className="text-ck-yellow hover:underline">
                  {edition.name}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">Identificador de URL</dt>
            <dd className="text-sm text-ck-text">{venue.slug}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">Capacidad</dt>
            <dd className="text-sm text-ck-text">{venue.capacity ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">Inicio</dt>
            <dd className="text-sm text-ck-text">{formatAdminDateTime(venue.startsAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">Fin</dt>
            <dd className="text-sm text-ck-text">{formatAdminDateTime(venue.endsAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">Contacto</dt>
            <dd className="text-sm text-ck-text">
              {[venue.contactName, venue.contactEmail, venue.contactPhone].filter(Boolean).join(" · ") ||
                "—"}
            </dd>
          </div>
        </dl>
        {venue.address ? <p className="text-sm text-ck-text-secondary">Dirección: {venue.address}</p> : null}
        {venue.meetingPoint ? (
          <p className="text-sm text-ck-text-secondary">Encuentro: {venue.meetingPoint}</p>
        ) : null}
      </Card>

      <VenueActionButtons
        venueId={venue.id}
        canDeactivate={venue.isActive}
        canDelete={Boolean(canDelete)}
        listHref={adminRoutes.venues}
      />
    </div>
  );
}
