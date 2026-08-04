import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import ClickatonContentPostForm from "@/components/admin/content/ClickatonContentPostForm";
import { ContentCmsSurface } from "@/components/admin/content/ContentCmsSurface";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminNewContentPage() {
  await requireClickatonAdmin();

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title="Nueva nota"
        description="Escribí la nota, elegí categoría y autor, y guardala como borrador hasta que esté lista para publicar."
        breadcrumbs={[
          { label: "Contenidos", href: adminRoutes.contents },
          { label: "Nueva nota" },
        ]}
      />

      <ContentCmsSurface>
        <ClickatonContentPostForm mode="create" />
      </ContentCmsSurface>
    </div>
  );
}
