import { notFound } from "next/navigation";
import { VenueForm } from "@/components/admin/venues/VenueForm";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { adminRoutes } from "@/config/admin/navigation";
import { getEditionById, listEditionOptions } from "@/lib/admin/editions/queries";
import { emptyVenueFormInput } from "@/lib/admin/venues/types";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { createVenueForEditionFormAction } from "@/app/admin/(panel)/sedes/actions";

type Props = {
  params: Promise<{ editionId: string }>;
};

export default async function NewVenueForEditionPage({ params }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;

  const editionResult = await getEditionById(editionId);
  if (!editionResult.ok) {
    return <AdminMigrationNotice message={editionResult.message} />;
  }
  if (!editionResult.data) notFound();

  const optionsResult = await listEditionOptions();
  const editions = optionsResult.ok
    ? optionsResult.data.map((e) => ({ id: e.id, name: e.name }))
    : [{ id: editionResult.data.id, name: editionResult.data.name }];

  const boundAction = createVenueForEditionFormAction.bind(null, editionId);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Nueva sede"
        description={`Para la edición ${editionResult.data.name}.`}
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: editionResult.data.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Nueva sede" },
        ]}
      />
      <VenueForm
        action={boundAction}
        editions={editions}
        initialValues={emptyVenueFormInput(editionId)}
        lockEdition
        cancelHref={`${adminRoutes.editions}/${editionId}`}
        submitLabel="Crear sede"
      />
    </div>
  );
}
