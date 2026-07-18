import { EditionForm } from "@/components/admin/editions/EditionForm";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { createEditionFormAction } from "../actions";

export default async function NewEditionPage() {
  await requireClickatonAdmin();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Nueva edición"
        description="Definí el producto de marca antes de crear sedes e integrar FotoRank."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: "Nueva" },
        ]}
      />
      <EditionForm
        action={createEditionFormAction}
        cancelHref={adminRoutes.editions}
        submitLabel="Crear edición"
      />
    </div>
  );
}
