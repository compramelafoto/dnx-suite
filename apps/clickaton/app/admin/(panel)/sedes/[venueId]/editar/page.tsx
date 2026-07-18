import { notFound } from "next/navigation";
import { VenueForm } from "@/components/admin/venues/VenueForm";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { adminRoutes } from "@/config/admin/navigation";
import { listEditionOptions } from "@/lib/admin/editions/queries";
import { getVenueById } from "@/lib/admin/venues/queries";
import { venueToFormInput } from "@/lib/admin/venues/types";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { updateVenueFormAction } from "../../actions";

type Props = {
  params: Promise<{ venueId: string }>;
};

export default async function EditVenuePage({ params }: Props) {
  await requireClickatonAdmin();
  const { venueId } = await params;

  const [venueResult, optionsResult] = await Promise.all([
    getVenueById(venueId),
    listEditionOptions(),
  ]);

  if (!venueResult.ok) {
    return <AdminMigrationNotice message={venueResult.message} />;
  }
  if (!venueResult.data) notFound();

  const editions = optionsResult.ok
    ? optionsResult.data.map((e) => ({ id: e.id, name: e.name }))
    : [{ id: venueResult.data.editionId, name: venueResult.data.edition?.name ?? "Edición" }];

  const boundAction = updateVenueFormAction.bind(null, venueId);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={`Editar: ${venueResult.data.name}`}
        breadcrumbs={[
          { label: "Sedes", href: adminRoutes.venues },
          { label: venueResult.data.name, href: `${adminRoutes.venues}/${venueId}` },
          { label: "Editar" },
        ]}
      />
      <VenueForm
        action={boundAction}
        editions={editions}
        initialValues={venueToFormInput(venueResult.data)}
        cancelHref={`${adminRoutes.venues}/${venueId}`}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
