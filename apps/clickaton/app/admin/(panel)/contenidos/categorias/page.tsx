import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ContentAdminNav } from "@/components/admin/content/ContentAdminNav";
import ContentTaxonomyManager from "@/components/admin/content/ContentTaxonomyManager";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminContentCategoriesPage() {
  await requireClickatonAdmin();

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title="Categorías del blog"
        description="Cada nota puede tener una categoría. Las categorías con notas publicadas aparecen como filtros en /blog."
        breadcrumbs={[
          { label: "Contenidos", href: adminRoutes.contents },
          { label: "Categorías" },
        ]}
      />

      <ContentAdminNav active="categorias" />

      <ContentTaxonomyManager kind="categories" />
    </div>
  );
}
