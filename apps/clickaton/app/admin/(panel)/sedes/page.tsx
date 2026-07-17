import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export default async function AdminVenuesPage() {
  await requireClickatonAdmin();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Sedes"
        description="Las sedes pertenecen a una edición organizada por Clickatón. No hay modelo de franquicias en el MVP."
        breadcrumbs={[{ label: "Sedes" }]}
      />

      <AdminEmptyState
        title="Sin sedes registradas"
        description="Cuando exista al menos una edición, podrás definir sedes con ciudad, punto de encuentro, responsable, capacidad y stock básico de kits."
        note="Una edición puede tener una sola sede o múltiples. Sin exclusividad territorial ni franquicias."
      />
    </div>
  );
}
