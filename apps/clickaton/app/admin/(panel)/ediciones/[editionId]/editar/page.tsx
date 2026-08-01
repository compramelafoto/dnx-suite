import { notFound } from "next/navigation";
import { EditionForm } from "@/components/admin/editions/EditionForm";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { adminRoutes } from "@/config/admin/navigation";
import { getEditionById } from "@/lib/admin/editions/queries";
import { editionToFormInput } from "@/lib/admin/editions/types";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { updateEditionFormAction } from "../../actions";

type Props = {
  params: Promise<{ editionId: string }>;
};

export default async function EditEditionPage({ params }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;
  const result = await getEditionById(editionId);

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <AdminMigrationNotice message={result.message} />
      </div>
    );
  }
  if (!result.data) notFound();

  const edition = result.data;
  const boundAction = updateEditionFormAction.bind(null, editionId);

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
        action={boundAction}
        editionId={edition.id}
        initialValues={editionToFormInput(edition)}
        cancelHref={`${adminRoutes.editions}/${edition.id}`}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
