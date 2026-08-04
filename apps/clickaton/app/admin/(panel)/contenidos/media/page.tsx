import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import ClickatonContentMediaLibrary from "@/components/admin/content/ClickatonContentMediaLibrary";
import { ContentAdminNav } from "@/components/admin/content/ContentAdminNav";
import { ContentCmsSurface } from "@/components/admin/content/ContentCmsSurface";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminContentMediaPage() {
  await requireClickatonAdmin();

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title="Multimedia del blog"
        description="Imágenes disponibles para insertar dentro de las notas. JPG, PNG o WebP hasta 5 MB."
        breadcrumbs={[
          { label: "Contenidos", href: adminRoutes.contents },
          { label: "Multimedia" },
        ]}
      />

      <ContentAdminNav active="media" />

      <ContentCmsSurface>
        <ClickatonContentMediaLibrary />
      </ContentCmsSurface>
    </div>
  );
}
