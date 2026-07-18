import { VenueForm } from "@/components/admin/venues/VenueForm";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { adminRoutes } from "@/config/admin/navigation";
import { listEditionOptions } from "@/lib/admin/editions/queries";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { createVenueFormAction } from "../actions";

export default async function NewVenuePage() {
  await requireClickatonAdmin();
  const optionsResult = await listEditionOptions();

  if (!optionsResult.ok) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Nueva sede"
          breadcrumbs={[
            { label: "Sedes", href: adminRoutes.venues },
            { label: "Nueva" },
          ]}
        />
        <AdminMigrationNotice message={optionsResult.message} />
      </div>
    );
  }

  const editions = optionsResult.data.map((e) => ({ id: e.id, name: e.name }));

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Nueva sede"
        breadcrumbs={[
          { label: "Sedes", href: adminRoutes.venues },
          { label: "Nueva" },
        ]}
      />
      {editions.length === 0 ? (
        <AdminMigrationNotice message="Creá una edición antes de registrar sedes." />
      ) : (
        <VenueForm
          action={createVenueFormAction}
          editions={editions}
          cancelHref={adminRoutes.venues}
          submitLabel="Crear sede"
        />
      )}
    </div>
  );
}
