import { HomeBannerForm } from "@/components/admin/home-banners/HomeBannerForm";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { listEditionOptions } from "@/lib/admin/editions/queries";

export default async function NewHomeBannerPage() {
  await requireClickatonAdmin();
  const editionsResult = await listEditionOptions();

  if (!editionsResult.ok) {
    return <AdminMigrationNotice message={editionsResult.message} />;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Nuevo banner"
        breadcrumbs={[
          { label: "Banners del inicio", href: adminRoutes.homeBanners },
          { label: "Nuevo" },
        ]}
      />
      <HomeBannerForm
        mode="create"
        editions={editionsResult.data.map((e) => ({ id: e.id, name: e.name }))}
        cancelHref={adminRoutes.homeBanners}
      />
    </div>
  );
}
