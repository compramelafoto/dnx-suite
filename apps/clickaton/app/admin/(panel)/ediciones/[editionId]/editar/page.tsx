import { EditionForm } from "@/components/admin/editions/EditionForm";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { adminRoutes } from "@/config/admin/navigation";
import { getEditionByIdOrSlug } from "@/lib/admin/editions/queries";
import { editionToFormInput } from "@/lib/admin/editions/types";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { updateEditionFormAction } from "../../actions";

type Props = {
  params: Promise<{ editionId: string }>;
};

export default async function EditEditionPage({ params }: Props) {
  await requireClickatonAdmin();
  const { editionId: editionIdOrSlug } = await params;
  const result = await getEditionByIdOrSlug(editionIdOrSlug);

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <AdminMigrationNotice message={result.message} />
      </div>
    );
  }
  if (!result.data) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Edición no encontrada"
          description="No hay una edición con ese identificador. Volvé al listado e ingresá de nuevo."
          breadcrumbs={[
            { label: "Ediciones", href: adminRoutes.editions },
            { label: "Editar" },
          ]}
        />
        <Button href={adminRoutes.editions} variant="primary">
          Volver a ediciones
        </Button>
      </div>
    );
  }

  const edition = result.data;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={`Editar: ${edition.name}`}
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${edition.id}` },
          { label: "Editar" },
        ]}
      />
      <EditionForm
        action={updateEditionFormAction}
        editionId={edition.id}
        initialValues={editionToFormInput(edition)}
        cancelHref={`${adminRoutes.editions}/${edition.id}`}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
