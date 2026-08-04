import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ContentAdminNav } from "@/components/admin/content/ContentAdminNav";
import ContentTaxonomyManager from "@/components/admin/content/ContentTaxonomyManager";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminContentTagsPage() {
  await requireClickatonAdmin();

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title="Tags del blog"
        description="Etiquetas transversales para agrupar notas de distintas categorías. Cada tag tiene su propia página pública."
        breadcrumbs={[
          { label: "Contenidos", href: adminRoutes.contents },
          { label: "Tags" },
        ]}
      />

      <ContentAdminNav active="tags" />

      <ContentTaxonomyManager kind="tags" />
    </div>
  );
}
