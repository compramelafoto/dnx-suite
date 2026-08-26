import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ContentAdminNav } from "@/components/admin/content/ContentAdminNav";
import ContentTaxonomyManager from "@/components/admin/content/ContentTaxonomyManager";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminContentAuthorsPage() {
  await requireClickatonAdmin();

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title="Autores del blog"
        description="Firmas visibles en las notas. Marcá un autor como inactivo para dejar de ofrecerlo en el formulario sin borrar su historial."
        breadcrumbs={[
          { label: "Contenidos", href: adminRoutes.contents },
          { label: "Autores" },
        ]}
      />

      <ContentAdminNav active="autores" />

      <ContentTaxonomyManager kind="authors" />
    </div>
  );
}
